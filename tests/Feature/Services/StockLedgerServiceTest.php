<?php

declare(strict_types=1);

use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->service = app(StockLedgerService::class);
    $this->product = Product::factory()->create();
    $this->warehouse = Warehouse::factory()->main()->create();
});

describe('registerIn (entrada)', function (): void {
    it('creates the initial balance on the first entry', function (): void {
        $movement = $this->service->registerIn(
            $this->product,
            $this->warehouse,
            '50000', // 50kg in grams
            '2.5000', // cost per gram
            'purchase',
        );

        expect($movement->type)->toBe('purchase')
            ->and($movement->quantity)->toEqual('50000.000000')
            ->and($movement->unit_cost)->toEqual('2.5000')
            ->and($movement->balance_quantity)->toEqual('50000.000000')
            ->and($movement->balance_unit_cost)->toEqual('2.5000')
            ->and($movement->balance_total_cost)->toEqual('125000.0000');

        $this->assertDatabaseHas('stocks', [
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'quantity' => '50000.000000',
            'average_cost' => '2.5000',
            'total_cost' => '125000.0000',
        ]);
    });

    it('computes the weighted average cost across multiple entries', function (): void {
        // 100 units @ 10.00 = 1000
        $this->service->registerIn($this->product, $this->warehouse, '100', '10.0000');
        // 100 units @ 20.00 = 2000 -> balance 200 units, total 3000, avg 15.00
        $movement = $this->service->registerIn($this->product, $this->warehouse, '100', '20.0000');

        expect($movement->balance_quantity)->toEqual('200.000000')
            ->and($movement->balance_unit_cost)->toEqual('15.0000')
            ->and($movement->balance_total_cost)->toEqual('3000.0000');

        $balance = $this->service->balance($this->product, $this->warehouse);
        expect($balance->average_cost)->toEqual('15.0000');
    });
});

describe('registerOut (salida)', function (): void {
    it('decreases the balance using the current average cost, unaffected by sale price', function (): void {
        $this->service->registerIn($this->product, $this->warehouse, '100', '10.0000');
        $this->service->registerIn($this->product, $this->warehouse, '100', '20.0000');
        // average is now 15.00; selling 50 units should cost 15.00 each regardless of any sale price

        $movement = $this->service->registerOut($this->product, $this->warehouse, '50', 'sale');

        expect($movement->type)->toBe('sale')
            ->and($movement->unit_cost)->toEqual('15.0000')
            ->and($movement->balance_quantity)->toEqual('150.000000')
            ->and($movement->balance_unit_cost)->toEqual('15.0000')
            ->and($movement->balance_total_cost)->toEqual('2250.0000');
    });

    it('resets average cost to zero once the balance reaches zero', function (): void {
        $this->service->registerIn($this->product, $this->warehouse, '100', '10.0000');

        $movement = $this->service->registerOut($this->product, $this->warehouse, '100', 'sale');

        expect($movement->balance_quantity)->toEqual('0.000000')
            ->and($movement->balance_unit_cost)->toEqual('0.0000')
            ->and($movement->balance_total_cost)->toEqual('0.0000');
    });

    it('throws when requesting more than the available stock', function (): void {
        $this->service->registerIn($this->product, $this->warehouse, '100', '10.0000');

        $this->service->registerOut($this->product, $this->warehouse, '150', 'sale');
    })->throws(InsufficientStockException::class);

    it('does not mutate stock when an out movement fails', function (): void {
        $this->service->registerIn($this->product, $this->warehouse, '100', '10.0000');

        try {
            $this->service->registerOut($this->product, $this->warehouse, '150', 'sale');
        } catch (InsufficientStockException) {
            // expected
        }

        $this->assertDatabaseHas('stocks', [
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'quantity' => '100.000000',
        ]);
    });
});

describe('balance (saldo)', function (): void {
    it('returns a zeroed balance for a product never moved in a warehouse', function (): void {
        $balance = $this->service->balance($this->product, $this->warehouse);

        expect($balance->quantity)->toEqual('0.000000')
            ->and($balance->average_cost)->toEqual('0.0000')
            ->and($balance->total_cost)->toEqual('0.0000');
    });

    it('keeps independent balances per warehouse for the same product', function (): void {
        $retail = Warehouse::factory()->retail()->create();

        $this->service->registerIn($this->product, $this->warehouse, '100', '10.0000');
        $this->service->registerIn($this->product, $retail, '30', '5.0000');

        expect($this->service->balance($this->product, $this->warehouse)->quantity)->toEqual('100.000000')
            ->and($this->service->balance($this->product, $retail)->quantity)->toEqual('30.000000');
    });

    it('builds a full kardex trail across purchase, transfer and sale movements', function (): void {
        $retail = Warehouse::factory()->retail()->create();

        $this->service->registerIn($this->product, $this->warehouse, '1000', '3.0000', 'purchase');
        $this->service->registerOut($this->product, $this->warehouse, '400', 'transfer_out');
        $this->service->registerIn($this->product, $retail, '400', '3.0000', 'transfer_in');
        $this->service->registerOut($this->product, $retail, '150', 'sale');

        $movements = App\Models\InventoryMovement::query()
            ->where('product_id', $this->product->id)
            ->orderBy('id')
            ->get(['type', 'balance_quantity', 'balance_unit_cost']);

        expect($movements->pluck('type')->all())->toBe(['purchase', 'transfer_out', 'transfer_in', 'sale'])
            ->and($movements->last()->balance_quantity)->toEqual('250.000000')
            ->and($movements->last()->balance_unit_cost)->toEqual('3.0000');
    });
});
