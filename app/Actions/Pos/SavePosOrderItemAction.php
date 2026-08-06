<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Actions\Pricing\ResolvePriceTierAction;
use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\Productable;
use App\Services\UnitConversionService;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;

final readonly class SavePosOrderItemAction
{
    public function __construct(
        private ResolvePriceTierAction $resolvePriceTierAction,
        private UnitConversionService $unitConversionService,
        private SyncPosSupplyRequestAction $syncSupplyRequestAction,
    ) {}

    /** @param numeric-string $quantity */
    public function add(
        CashRegisterSession $session,
        PosOrder $order,
        Product $product,
        string $quantity,
        ?string $unitCode = null,
        ?int $actorId = null,
        ?string $warehouseNotes = null,
        bool $warehouseNotesProvided = false,
    ): PosOrder {
        return DB::transaction(function () use ($session, $order, $product, $quantity, $unitCode, $actorId, $warehouseNotes, $warehouseNotesProvided): PosOrder {
            [$lockedSession, $lockedOrder] = $this->lockContext($session, $order);
            $availableProduct = $this->availableProduct($lockedSession, $product);
            $quantityInBaseUnit = $this->unitConversionService->toBaseUnitFromCode(
                $availableProduct,
                $quantity,
                $unitCode,
            );
            $item = $lockedOrder->items()
                ->where('product_id', $availableProduct->id)
                ->lockForUpdate()
                ->first();
            if ($item instanceof Productable) {
                /** @var numeric-string $currentQuantity */
                $currentQuantity = $item->quantity;
                $newQuantity = bcadd($currentQuantity, $quantityInBaseUnit, 6);
            } else {
                $newQuantity = bcadd('0', $quantityInBaseUnit, 6);
            }

            $this->saveLine($lockedOrder, $availableProduct, $item, $newQuantity, $warehouseNotes, $warehouseNotesProvided);
            $this->syncSupplyRequestAction->execute($lockedOrder, $actorId);

            return $this->refreshTotals($lockedOrder);
        });
    }

    /** @param numeric-string $quantity */
    public function update(
        CashRegisterSession $session,
        PosOrder $order,
        Productable $item,
        string $quantity,
        ?string $unitCode = null,
        ?int $actorId = null,
        ?string $warehouseNotes = null,
        bool $warehouseNotesProvided = false,
    ): PosOrder {
        return DB::transaction(function () use ($session, $order, $item, $quantity, $unitCode, $actorId, $warehouseNotes, $warehouseNotesProvided): PosOrder {
            [$lockedSession, $lockedOrder] = $this->lockContext($session, $order);
            $lockedItem = $lockedOrder->items()->lockForUpdate()->find($item->id);

            if (! $lockedItem instanceof Productable) {
                throw PosOrderException::itemDoesNotBelongToOrder();
            }

            $product = Product::query()->findOrFail($lockedItem->product_id);
            $availableProduct = $this->availableProduct($lockedSession, $product);
            $quantityInBaseUnit = $this->unitConversionService->toBaseUnitFromCode(
                $availableProduct,
                $quantity,
                $unitCode,
            );
            $this->saveLine(
                $lockedOrder,
                $availableProduct,
                $lockedItem,
                $quantityInBaseUnit,
                $warehouseNotes,
                $warehouseNotesProvided,
            );
            $this->syncSupplyRequestAction->execute($lockedOrder, $actorId);

            return $this->refreshTotals($lockedOrder);
        });
    }

    public function remove(
        CashRegisterSession $session,
        PosOrder $order,
        Productable $item,
        ?int $actorId = null,
    ): PosOrder {
        return DB::transaction(function () use ($session, $order, $item, $actorId): PosOrder {
            [, $lockedOrder] = $this->lockContext($session, $order);
            $lockedItem = $lockedOrder->items()->lockForUpdate()->find($item->id);

            if (! $lockedItem instanceof Productable) {
                throw PosOrderException::itemDoesNotBelongToOrder();
            }

            $lockedItem->delete();
            $this->syncSupplyRequestAction->execute($lockedOrder, $actorId);

            return $this->refreshTotals($lockedOrder);
        });
    }

    /** @return array{CashRegisterSession, PosOrder} */
    private function lockContext(CashRegisterSession $session, PosOrder $order): array
    {
        $lockedSession = CashRegisterSession::query()->lockForUpdate()->findOrFail($session->id);

        if ($lockedSession->status !== 'open') {
            throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
        }

        $lockedOrder = PosOrder::query()
            ->where('cash_register_session_id', $lockedSession->id)
            ->lockForUpdate()
            ->find($order->id);

        if (! $lockedOrder instanceof PosOrder) {
            throw PosOrderException::doesNotBelongToSession();
        }

        if ($lockedOrder->status !== 'open') {
            throw PosOrderException::notOpen($lockedOrder->id);
        }

        return [$lockedSession, $lockedOrder];
    }

    private function availableProduct(CashRegisterSession $session, Product $product): Product
    {
        $storeId = $session->cashRegister()->value('store_id');
        $availableProduct = Product::query()
            ->whereKey($product->id)
            ->where('is_active', true)
            ->where(function ($availability) use ($storeId): void {
                $availability
                    ->whereHas('stocks.warehouse', function ($query) use ($storeId): void {
                        $query->where('store_id', $storeId);
                    })
                    ->orWhereHas(
                        'template.principalVariant.stocks.warehouse',
                        function ($query) use ($storeId): void {
                            $query->where('store_id', $storeId);
                        },
                    );
            })
            ->lockForUpdate()
            ->first();

        if (! $availableProduct instanceof Product) {
            throw PosOrderException::productUnavailable($product->id);
        }

        return $availableProduct;
    }

    /** @param numeric-string $quantity */
    private function saveLine(
        PosOrder $order,
        Product $product,
        ?Productable $item,
        string $quantity,
        ?string $warehouseNotes,
        bool $warehouseNotesProvided,
    ): void {
        $priceTier = $this->resolvePriceTierAction->execute($product, $quantity);
        /** @var numeric-string $unitPrice */
        $unitPrice = (string) $priceTier->unit_price;
        $lineTotal = bcmul($quantity, $unitPrice, 4);
        $values = [
            'product_id' => $product->id,
            'quantity' => $quantity,
            'input_quantity' => $quantity,
            'input_unit_id' => $product->base_unit_id,
            'price_tier_id' => $priceTier->id,
            'unit_price' => $priceTier->unit_price,
            'line_total' => $lineTotal,
        ];

        if (! $item instanceof Productable || $warehouseNotesProvided) {
            $values['warehouse_notes'] = $warehouseNotes;
        }

        if ($item instanceof Productable) {
            $item->update($values);

            return;
        }

        $order->items()->create($values);
    }

    private function refreshTotals(PosOrder $order): PosOrder
    {
        $subtotal = '0.0000';
        foreach ($order->items()->pluck('line_total') as $lineTotal) {
            if (! is_numeric($lineTotal)) {
                continue;
            }

            /** @var numeric-string $numericLineTotal */
            $numericLineTotal = (string) $lineTotal;
            $subtotal = bcadd($subtotal, $numericLineTotal, 4);
        }

        $order->update(['subtotal' => $subtotal, 'total' => $subtotal]);

        return $order->fresh([
            'customer',
            'items.product.baseUnit',
            'items.product.contentUnit',
            'items.product.template',
            'items.product.priceTiers' => function (Relation $relation): void {
                $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
            },
            'supplyRequests.items.product.baseUnit',
            'supplyRequests.assignee',
            'supplyRequests.fromWarehouse.store',
            'supplyRequests.toWarehouse.store',
        ]) ?? $order;
    }
}
