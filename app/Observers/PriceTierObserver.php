<?php

declare(strict_types=1);

namespace App\Observers;

use App\Models\PriceTier;
use App\Services\PriceChangeNotificationService;

final readonly class PriceTierObserver
{
    private const TRACKED_FIELDS = [
        'unit_price',
        'min_quantity',
        'max_quantity',
        'is_active',
    ];

    public function __construct(private PriceChangeNotificationService $notificationService) {}

    public function created(PriceTier $priceTier): void
    {
        $this->notificationService->record($priceTier, null, $this->snapshot($priceTier), 'created');
    }

    public function updated(PriceTier $priceTier): void
    {
        if (! $priceTier->wasChanged(self::TRACKED_FIELDS)) {
            return;
        }

        $old = [];
        foreach (self::TRACKED_FIELDS as $field) {
            $old[$field] = $priceTier->getOriginal($field);
        }
        $old['label'] = $priceTier->getOriginal('label');

        $this->notificationService->record($priceTier, $old, $this->snapshot($priceTier), 'updated');
    }

    public function deleted(PriceTier $priceTier): void
    {
        $this->notificationService->record($priceTier, $this->snapshot($priceTier), null, 'deleted');
    }

    /** @return array<string, mixed> */
    private function snapshot(PriceTier $priceTier): array
    {
        return [
            'unit_price' => $priceTier->unit_price,
            'min_quantity' => $priceTier->min_quantity,
            'max_quantity' => $priceTier->max_quantity,
            'is_active' => $priceTier->is_active,
            'label' => $priceTier->label,
        ];
    }
}
