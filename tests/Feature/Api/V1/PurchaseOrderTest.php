<?php

declare(strict_types=1);

use App\Actions\Purchasing\RegisterPurchaseAction;
use App\Exceptions\PurchaseOrderStateException;
use App\Models\DocumentSeries;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductTemplate;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'purchase-orders.view', 'purchase-orders.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    $this->supplier = Supplier::factory()->create();
    $this->warehouse = Warehouse::factory()->main()->create();
    $this->product = Product::factory()->create();
    DocumentSeries::query()->updateOrCreate(
        ['document_type' => 'purchase', 'series_code' => 'OC01'],
        ['current_number' => 0, 'is_active' => true],
    );
});

it('creates a purchase order in draft status', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'invoice_series' => 'F001',
        'invoice_number' => '00001234',
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 100, 'unit_cost' => 3],
        ],
    ]);

    $response->assertCreated()->assertJson(['data' => [
        'status' => 'draft',
        'full_number' => 'OC01-00000001',
        'invoice_full_number' => 'F001-00001234',
        'total' => '300.0000',
    ]]);

    $this->assertDatabaseHas('purchase_orders', [
        'status' => 'draft',
        'series_code' => 'OC01',
        'number' => 1,
        'invoice_series' => 'F001',
        'invoice_number' => '00001234',
        'total' => '300.0000',
    ]);
    $this->assertDatabaseHas('productables', [
        'productable_type' => PurchaseOrder::class,
        'productable_id' => $response->json('data.id'),
        'product_id' => $this->product->id,
        'quantity' => '0.000000',
        'quantity_purchased' => '100.000000',
        'unit_cost' => '3.0000',
    ]);
    $response->assertJsonPath('data.items.0.quantity_base', '0.000000');
});

it('returns the selected product details when opening a purchase', function (): void {
    $order = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 10],
        ],
    ])->assertCreated()->json('data');

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/purchase-orders/{$order['id']}")
        ->assertOk()
        ->assertJsonPath('data.items.0.product.id', $this->product->id)
        ->assertJsonPath('data.items.0.product.sku', $this->product->sku)
        ->assertJsonPath('data.items.0.product.base_unit.code', 'kg');
});

it('generates consecutive purchase numbers and calculates each total', function (): void {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 3, 'unit_cost' => 12.50],
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 4.25],
        ],
    ];

    $first = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', $payload);
    $second = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', $payload);

    $first->assertCreated()
        ->assertJsonPath('data.full_number', 'OC01-00000001')
        ->assertJsonPath('data.total', '46.0000');
    $second->assertCreated()
        ->assertJsonPath('data.full_number', 'OC01-00000002')
        ->assertJsonPath('data.total', '46.0000');

    $this->assertDatabaseHas('document_series', [
        'document_type' => 'purchase',
        'series_code' => 'OC01',
        'current_number' => 2,
    ]);
});

it('allows creating a purchase order without an invoice number', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'notes' => 'Factura pendiente de entrega',
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 15],
        ],
    ]);

    $response->assertCreated()->assertJsonPath('data.invoice_number', null);
});

it('requires invoice series and correlative together', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'invoice_series' => 'F001',
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 15],
        ],
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('invoice_number');
});

it('updates a draft purchase order, replaces its items and recalculates the total', function (): void {
    $order = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 10],
        ],
    ])->json('data');

    $response = $this->withHeaders($this->headers)->putJson("/api/v1/purchase-orders/{$order['id']}", [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->subDay()->toDateString(),
        'invoice_series' => 'F002',
        'invoice_number' => '99',
        'notes' => 'Compra corregida',
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 4, 'unit_cost' => 7.50],
        ],
    ]);

    $response->assertOk()
        ->assertJsonPath('data.full_number', 'OC01-00000001')
        ->assertJsonPath('data.invoice_full_number', 'F002-99')
        ->assertJsonPath('data.total', '30.0000')
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.quantity_purchased', '4.000000');

    $this->assertDatabaseCount('productables', 1);
    $this->assertDatabaseHas('purchase_orders', [
        'id' => $order['id'],
        'status' => 'draft',
        'series_code' => 'OC01',
        'number' => 1,
        'total' => '30.0000',
    ]);
});

it('rejects updating a confirmed purchase order', function (): void {
    $payload = [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 10],
        ],
    ];
    $order = $this->withHeaders($this->headers)
        ->postJson('/api/v1/purchase-orders', $payload)
        ->json('data');
    $this->withHeaders($this->headers)
        ->postJson("/api/v1/purchase-orders/{$order['id']}/confirm")
        ->assertOk();

    $this->withHeaders($this->headers)
        ->putJson("/api/v1/purchase-orders/{$order['id']}", $payload)
        ->assertUnprocessable();
});

it('confirming a purchase order for a packaged variant credits the principal in its base unit', function (): void {
    $grams = UnitOfMeasure::factory()->grams()->create();
    $kilograms = UnitOfMeasure::query()->where('code', 'kg')->firstOrFail();
    $units = UnitOfMeasure::factory()->units()->create();

    $template = ProductTemplate::query()->create([
        'name' => 'Arroz Extra',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $principal = Product::factory()->create([
        'product_template_id' => $template->id,
        'name' => 'Arroz Extra - Granel',
        'variant_name' => 'Granel',
        'sku' => 'ARROZ-COMPRA-GRANEL',
        'base_unit_id' => $grams->id,
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    $saco = Product::factory()->create([
        'product_template_id' => $template->id,
        'name' => 'Arroz Extra - Saco 50kg',
        'variant_name' => 'Saco 50kg',
        'sku' => 'ARROZ-COMPRA-SACO50',
        'base_unit_id' => $units->id,
        'sale_mode' => 'unit',
        'content_quantity' => 50,
        'content_unit_id' => $kilograms->id,
        'is_principal' => false,
    ]);

    $order = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            [
                'product_id' => $saco->id,
                'quantity_purchased' => 10, // 10 sacos
                'unit_cost' => 100, // 100 per saco
            ],
        ],
    ])->json('data');

    $response = $this->withHeaders($this->headers)->postJson("/api/v1/purchase-orders/{$order['id']}/confirm");

    $response->assertOk()->assertJson(['data' => ['status' => 'confirmed']]);

    // 10 sacos * 50kg = 500000 g; cost per gram = 100/50000 = 0.002
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $principal->id,
        'quantity' => '500000.000000',
        'average_cost' => '0.0020',
    ]);
    $this->assertDatabaseMissing('stocks', ['product_id' => $saco->id]);

    $this->assertDatabaseHas('productables', [
        'productable_type' => PurchaseOrder::class,
        'productable_id' => $order['id'],
        'product_id' => $saco->id,
        'stock_product_id' => $principal->id,
        'quantity' => '10.000000',
        'stock_quantity' => '500000.000000',
    ]);

    $this->assertDatabaseHas('inventory_movements', [
        'type' => 'purchase',
        'reference_type' => PurchaseOrder::class,
        'reference_id' => $order['id'],
        'product_id' => $principal->id,
        'quantity' => '500000.000000',
    ]);
});

it('rejects creating a purchase order for a template variant with no principal, before writing any rows', function (): void {
    $template = ProductTemplate::query()->create([
        'name' => 'Sin Principal',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $orphanVariant = Product::factory()->create([
        'product_template_id' => $template->id,
        'is_principal' => false,
        'sale_mode' => 'unit',
    ]);

    $response = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $orphanVariant->id, 'quantity_purchased' => 5, 'unit_cost' => 10],
        ],
    ]);

    $response->assertUnprocessable();
    $this->assertDatabaseCount('purchase_orders', 0);
});

it('rejects updating a draft with a template variant with no principal, leaving the draft unchanged', function (): void {
    $order = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 2, 'unit_cost' => 10],
        ],
    ])->json('data');

    $template = ProductTemplate::query()->create([
        'name' => 'Sin Principal',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $orphanVariant = Product::factory()->create([
        'product_template_id' => $template->id,
        'is_principal' => false,
        'sale_mode' => 'unit',
    ]);

    $response = $this->withHeaders($this->headers)->putJson("/api/v1/purchase-orders/{$order['id']}", [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $orphanVariant->id, 'quantity_purchased' => 5, 'unit_cost' => 10],
        ],
    ]);

    $response->assertUnprocessable();
    $this->assertDatabaseHas('purchase_orders', [
        'id' => $order['id'],
        'total' => '20.0000',
    ]);
    $this->assertDatabaseCount('productables', 1);
});

it('rejects a purchase order targeting the pos warehouse', function (): void {
    $posWarehouse = Warehouse::factory()->pos()->create();

    $response = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $posWarehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 100, 'unit_cost' => 3],
        ],
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('warehouse_id');
});

it('accepts a purchase order targeting the retail warehouse', function (): void {
    $retailWarehouse = Warehouse::factory()->retail()->create();

    $response = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $retailWarehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 100, 'unit_cost' => 3],
        ],
    ]);

    $response->assertCreated();
});

it('fails to confirm an already confirmed order', function (): void {
    $order = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 100, 'unit_cost' => 3],
        ],
    ])->json('data');

    $this->withHeaders($this->headers)->postJson("/api/v1/purchase-orders/{$order['id']}/confirm")->assertOk();

    $this->withHeaders($this->headers)->postJson("/api/v1/purchase-orders/{$order['id']}/confirm")
        ->assertUnprocessable();
});

it('rechecks the locked purchase state when the action receives a stale draft instance', function (): void {
    $orderData = $this->withHeaders($this->headers)->postJson('/api/v1/purchase-orders', [
        'supplier_id' => $this->supplier->id,
        'warehouse_id' => $this->warehouse->id,
        'ordered_at' => now()->toDateString(),
        'items' => [
            ['product_id' => $this->product->id, 'quantity_purchased' => 100, 'unit_cost' => 3],
        ],
    ])->assertCreated()->json('data');
    $staleDraft = PurchaseOrder::query()->findOrFail($orderData['id']);
    $action = app(RegisterPurchaseAction::class);

    $action->execute($staleDraft);

    expect(fn () => $action->execute($staleDraft))
        ->toThrow(PurchaseOrderStateException::class);

    expect(InventoryMovement::query()
        ->where('reference_type', PurchaseOrder::class)
        ->where('reference_id', $staleDraft->id)
        ->count())->toBe(1);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'quantity' => '100.000000',
    ]);
});
