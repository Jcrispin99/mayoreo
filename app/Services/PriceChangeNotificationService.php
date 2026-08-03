<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\User;
use App\Notifications\PriceChangedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

final readonly class PriceChangeNotificationService
{
    private const int HIGHLIGHT_HOURS = 72;

    public function __construct(private ExpoPushNotificationService $pushService) {}

    /**
     * @param array<string, mixed>|null $old
     * @param array<string, mixed>|null $new
     */
    public function record(PriceTier $priceTier, ?array $old, ?array $new, string $operation): void
    {
        $actor = request()?->user();
        if (! $actor instanceof User) {
            return;
        }

        $product = $priceTier->product()->with(['baseUnit', 'template'])->first();
        if (! $product instanceof Product) {
            return;
        }

        $occurredAt = now();
        $highlightUntil = $occurredAt->copy()->addHours(self::HIGHLIGHT_HOURS);
        $product->forceFill([
            'price_changed_at' => $occurredAt,
            'price_highlight_until' => $highlightUntil,
        ])->saveQuietly();

        $recipients = User::permission('price-notifications.receive')->get();
        if ($recipients->isEmpty()) {
            return;
        }

        [$factor, $priceUnit] = $this->commercialUnit($product);
        $oldPrice = $this->commercialPrice($old['unit_price'] ?? null, $factor);
        $newPrice = $this->commercialPrice($new['unit_price'] ?? null, $factor);
        $direction = $this->direction($oldPrice, $newPrice, $operation);
        $eventId = (string) Str::uuid();
        $tierLabel = (string) (($new['label'] ?? null) ?: ($old['label'] ?? null) ?: 'Precio de venta');
        $payload = [
            'kind' => 'price_change',
            'event_id' => $eventId,
            'operation' => $operation,
            'direction' => $direction,
            'product_id' => $product->id,
            'product_name' => $product->display_name,
            'product_sku' => $product->sku,
            'price_tier_id' => $operation === 'deleted' ? null : $priceTier->id,
            'tier_label' => $tierLabel,
            'old_price' => $oldPrice,
            'new_price' => $newPrice,
            'price_unit' => $priceUnit,
            'old_min_quantity' => $old['min_quantity'] ?? null,
            'new_min_quantity' => $new['min_quantity'] ?? null,
            'old_max_quantity' => $old['max_quantity'] ?? null,
            'new_max_quantity' => $new['max_quantity'] ?? null,
            'old_active' => $old['is_active'] ?? null,
            'new_active' => $new['is_active'] ?? null,
            'percentage_change' => $this->percentageChange($oldPrice, $newPrice),
            'reason' => 'Actualización de precios',
            'changed_by' => $actor->id,
            'changed_by_name' => $actor->name,
            'occurred_at' => $occurredAt->toIso8601String(),
            'highlight_until' => $highlightUntil->toIso8601String(),
        ];

        Notification::send($recipients, new PriceChangedNotification($payload));

        $recipientIds = $recipients->modelKeys();
        $title = 'Precio actualizado';
        $body = $this->pushBody($product->display_name, $tierLabel, $oldPrice, $newPrice, $priceUnit, $operation);

        DB::afterCommit(fn () => $this->pushService->sendToUsers(
            $recipientIds,
            $title,
            $body,
            [
                'kind' => 'price_change',
                'event_id' => $eventId,
                'product_id' => $product->id,
                'url' => '/home?notifications=1',
            ],
        ));
    }

    /** @return array{int, string} */
    private function commercialUnit(Product $product): array
    {
        $code = mb_strtolower((string) $product->baseUnit?->code);

        return match ($code) {
            'g', 'gr' => [1000, 'kg'],
            'ml' => [1000, 'L'],
            default => [1, $product->baseUnit?->code ?: 'un.'],
        };
    }

    private function commercialPrice(mixed $price, int $factor): ?string
    {
        if (! is_numeric($price)) {
            return null;
        }

        return number_format((float) $price * $factor, 2, '.', '');
    }

    private function direction(?string $oldPrice, ?string $newPrice, string $operation): string
    {
        if ($operation === 'created') {
            return 'created';
        }
        if ($operation === 'deleted') {
            return 'deleted';
        }
        if ($oldPrice === null || $newPrice === null || bccomp($oldPrice, $newPrice, 2) === 0) {
            return 'changed';
        }

        return bccomp($newPrice, $oldPrice, 2) > 0 ? 'increased' : 'decreased';
    }

    private function percentageChange(?string $oldPrice, ?string $newPrice): ?string
    {
        if ($oldPrice === null || $newPrice === null || bccomp($oldPrice, '0', 2) <= 0) {
            return null;
        }

        return number_format((((float) $newPrice - (float) $oldPrice) / (float) $oldPrice) * 100, 2, '.', '');
    }

    private function pushBody(
        string $productName,
        string $tierLabel,
        ?string $oldPrice,
        ?string $newPrice,
        string $priceUnit,
        string $operation,
    ): string {
        if ($operation === 'created') {
            return "{$productName} · {$tierLabel}: nuevo precio S/ {$newPrice}/{$priceUnit}";
        }
        if ($operation === 'deleted') {
            return "{$productName} · {$tierLabel}: precio eliminado";
        }
        if ($oldPrice === $newPrice) {
            return "{$productName} · {$tierLabel}: condiciones actualizadas";
        }

        return "{$productName} · {$tierLabel}: S/ {$oldPrice} → S/ {$newPrice}/{$priceUnit}";
    }
}
