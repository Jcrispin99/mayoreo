<?php

declare(strict_types=1);

use App\Models\InventoryMovement;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'products.view', 'products.manage');
    $this->token = $user->createToken('test-token')->plainTextToken;
    $this->headers = ['Authorization' => 'Bearer '.$this->token];
});

describe('Units of measure', function (): void {
    it('creates and lists units of measure', function (): void {
        $response = $this->withHeaders($this->headers)->postJson('/api/v1/units-of-measure', [
            'code' => 'g',
            'name' => 'Gramos',
            'type' => 'weight',
        ]);

        $response->assertCreated()->assertJson([
            'data' => ['code' => 'g', 'type' => 'weight'],
        ]);

        $this->withHeaders($this->headers)->getJson('/api/v1/units-of-measure')
            ->assertOk()->assertJsonCount(1, 'data');
    });

    it('fails with an invalid type', function (): void {
        $this->withHeaders($this->headers)->postJson('/api/v1/units-of-measure', [
            'code' => 'x',
            'name' => 'Invalid',
            'type' => 'weird',
        ])->assertUnprocessable()->assertJsonValidationErrors('type');
    });

    it('updates and deletes an unused unit of measure', function (): void {
        $unit = UnitOfMeasure::factory()->create();

        $this->withHeaders($this->headers)->putJson("/api/v1/units-of-measure/{$unit->id}", [
            'name' => 'Unidad actualizada',
        ])->assertOk()->assertJsonPath('data.name', 'Unidad actualizada');

        $this->withHeaders($this->headers)->deleteJson("/api/v1/units-of-measure/{$unit->id}")
            ->assertNoContent();
    });

    it('does not delete a unit used by a product', function (): void {
        $unit = UnitOfMeasure::factory()->create();
        Product::factory()->create(['base_unit_id' => $unit->id]);

        $this->withHeaders($this->headers)->deleteJson("/api/v1/units-of-measure/{$unit->id}")
            ->assertUnprocessable();
    });
});

describe('Products', function (): void {
    it('creates a product with its base unit and converts a purchase presentation', function (): void {
        $grams = UnitOfMeasure::factory()->grams()->create();

        $product = $this->withHeaders($this->headers)->postJson('/api/v1/products', [
            'sku' => 'PECANAS-001',
            'name' => 'Pecanas',
            'base_unit_id' => $grams->id,
        ])->assertCreated()->json('data');

        expect($product['base_unit_id'])->toBe($grams->id);

        // 1 saco de 50kg = 50000 g
        $purchaseUnit = $this->withHeaders($this->headers)
            ->postJson("/api/v1/products/{$product['id']}/purchase-units", [
                'name' => 'saco 50kg',
                'conversion_factor' => 50000,
            ])->assertCreated()->json('data');

        expect((float) $purchaseUnit['conversion_factor'])->toBe(50000.0);

        $shown = $this->withHeaders($this->headers)
            ->getJson("/api/v1/products/{$product['id']}")
            ->assertOk()->json('data');

        expect($shown['purchase_units'])->toHaveCount(1);
    });

    it('filters products by search term', function (): void {
        $grams = UnitOfMeasure::factory()->grams()->create();
        Product::factory()->create(['name' => 'Harina de trigo', 'sku' => 'HAR-001', 'base_unit_id' => $grams->id]);
        Product::factory()->create(['name' => 'Pecanas', 'sku' => 'PEC-001', 'base_unit_id' => $grams->id]);

        $this->withHeaders($this->headers)->getJson('/api/v1/products?search=harina')
            ->assertOk()->assertJsonCount(1, 'data');
    });

    it('lists the active prices needed by the product table', function (): void {
        $product = Product::factory()->create();
        PriceTier::factory()->for($product)->create([
            'min_quantity' => 0,
            'max_quantity' => 9,
            'unit_price' => 16.20,
            'is_active' => true,
        ]);
        PriceTier::factory()->for($product)->create([
            'min_quantity' => 10,
            'max_quantity' => null,
            'unit_price' => 12,
            'is_active' => false,
        ]);

        $this->withHeaders($this->headers)->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonCount(1, 'data.0.price_tiers')
            ->assertJsonPath('data.0.price_tiers.0.unit_price', '16.2000');
    });

    it('marks and unmarks a product as favorite', function (): void {
        $product = Product::factory()->create();

        $this->withHeaders($this->headers)
            ->patchJson("/api/v1/products/{$product->id}", ['is_favorite' => true])
            ->assertOk()
            ->assertJsonPath('data.is_favorite', true);

        $this->withHeaders($this->headers)
            ->patchJson("/api/v1/products/{$product->id}", ['is_favorite' => false])
            ->assertOk()
            ->assertJsonPath('data.is_favorite', false);
    });

    it('does not allow bypassing the historical unit protection through the product endpoint', function (): void {
        $grams = UnitOfMeasure::factory()->grams()->create();
        $units = UnitOfMeasure::factory()->create([
            'code' => 'NIU',
            'name' => 'Unidad',
            'type' => 'count',
        ]);
        $product = Product::factory()->create([
            'base_unit_id' => $grams->id,
            'sale_mode' => 'measured',
        ]);
        InventoryMovement::factory()->create(['product_id' => $product->id]);

        $this->withHeaders($this->headers)
            ->patchJson("/api/v1/products/{$product->id}", [
                'base_unit_id' => $units->id,
                'sale_mode' => 'unit',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('base_unit_id');

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'base_unit_id' => $grams->id,
            'sale_mode' => 'measured',
        ]);
    });

    it('does not allow deleting the principal variant', function (): void {
        $product = Product::factory()->create(['is_principal' => true]);

        $this->withHeaders($this->headers)
            ->deleteJson("/api/v1/products/{$product->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product');

        $this->assertNotSoftDeleted($product);
    });

    it('fails with a duplicate sku', function (): void {
        $grams = UnitOfMeasure::factory()->grams()->create();
        Product::factory()->create(['sku' => 'DUP-001', 'base_unit_id' => $grams->id]);

        $this->withHeaders($this->headers)->postJson('/api/v1/products', [
            'sku' => 'DUP-001',
            'name' => 'Duplicado',
            'base_unit_id' => $grams->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('sku');
    });

    it('creates a product with a barcode and fails on duplicates', function (): void {
        $grams = UnitOfMeasure::factory()->grams()->create();

        $product = $this->withHeaders($this->headers)->postJson('/api/v1/products', [
            'sku' => 'PECANAS-002',
            'barcode' => '7501234567890',
            'name' => 'Pecanas con codigo',
            'base_unit_id' => $grams->id,
        ])->assertCreated()->json('data');

        expect($product['barcode'])->toBe('7501234567890');

        $this->withHeaders($this->headers)->postJson('/api/v1/products', [
            'sku' => 'PECANAS-003',
            'barcode' => '7501234567890',
            'name' => 'Otra con mismo codigo',
            'base_unit_id' => $grams->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('barcode');
    });

    it('uploads an image for a product', function (): void {
        Storage::fake('public');

        $template = ProductTemplate::query()->create([
            'name' => 'Producto con imagen',
            'is_active' => true,
            'is_pos_visible' => true,
        ]);
        $product = Product::factory()->create([
            'product_template_id' => $template->id,
            'is_principal' => true,
        ]);

        $response = $this->withHeaders($this->headers)
            ->postJson("/api/v1/products/{$product->id}/image", [
                'image' => UploadedFile::fake()->image('product.jpg'),
            ])->assertOk()->json('data');

        expect($response['image_url'])->not->toBeNull();

        $product->refresh();
        Storage::disk('public')->assertExists($product->image_path);
        expect($template->refresh()->image_path)->toBe($product->image_path);
    });
});

describe('Price tiers', function (): void {
    it('creates non-overlapping tiers for pecanas and resolves the right one per quantity', function (): void {
        $product = Product::factory()->create();

        $tiers = [
            ['min_quantity' => 50000, 'max_quantity' => null, 'unit_price' => 8, 'label' => 'Gran mayor'],
            ['min_quantity' => 2000, 'max_quantity' => 49999.999999, 'unit_price' => 10, 'label' => 'Mayor'],
            ['min_quantity' => 250, 'max_quantity' => 1999.999999, 'unit_price' => 12, 'label' => 'Menudeo'],
            ['min_quantity' => 0, 'max_quantity' => 249.999999, 'unit_price' => 16.2, 'label' => 'Fraccionado'],
        ];

        foreach ($tiers as $tier) {
            $this->withHeaders($this->headers)
                ->postJson("/api/v1/products/{$product->id}/price-tiers", $tier)
                ->assertCreated();
        }

        $this->assertDatabaseCount('price_tiers', 4);
    });

    it('rejects an overlapping range', function (): void {
        $product = Product::factory()->create();

        PriceTier::factory()->for($product)->create(['min_quantity' => 0, 'max_quantity' => 999]);

        $this->withHeaders($this->headers)
            ->postJson("/api/v1/products/{$product->id}/price-tiers", [
                'min_quantity' => 500,
                'max_quantity' => 1500,
                'unit_price' => 5,
            ])
            ->assertUnprocessable();
    });

    it('allows adjacent (non-overlapping) ranges', function (): void {
        $product = Product::factory()->create();

        PriceTier::factory()->for($product)->create(['min_quantity' => 0, 'max_quantity' => 999.999999]);

        $this->withHeaders($this->headers)
            ->postJson("/api/v1/products/{$product->id}/price-tiers", [
                'min_quantity' => 1000,
                'max_quantity' => 1999.999999,
                'unit_price' => 5,
            ])
            ->assertCreated();
    });
});

describe('Product purchase units', function (): void {
    it('updates and deletes a purchase unit', function (): void {
        $purchaseUnit = ProductPurchaseUnit::factory()->create(['name' => 'saco 50kg', 'conversion_factor' => 50000]);

        $this->withHeaders($this->headers)
            ->putJson("/api/v1/purchase-units/{$purchaseUnit->id}", ['conversion_factor' => 25000])
            ->assertOk()->assertJson(['data' => ['conversion_factor' => '25000.000000']]);

        $this->withHeaders($this->headers)
            ->deleteJson("/api/v1/purchase-units/{$purchaseUnit->id}")
            ->assertNoContent();
    });
});
