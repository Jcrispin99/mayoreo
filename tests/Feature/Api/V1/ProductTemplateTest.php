<?php

declare(strict_types=1);

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'products.view', 'products.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('templates')->plainTextToken];
    $this->grams = UnitOfMeasure::factory()->grams()->create();
    $this->units = UnitOfMeasure::factory()->create([
        'code' => 'NIU',
        'name' => 'Unidad',
        'type' => 'count',
    ]);
});

it('creates a product template with packaged and measured variants and variant prices', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Arroz Extra',
        'description' => 'Familia de arroz',
        'is_active' => true,
        'is_pos_visible' => true,
        'variants' => [
            [
                'variant_name' => 'Granel',
                'sku' => 'ARROZ-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'is_principal' => true,
                'base_price' => 0.01,
            ],
            [
                'variant_name' => 'Bolsa 100 g',
                'sku' => 'ARROZ-100G',
                'barcode' => '7750000000100',
                'base_unit_id' => $this->units->id,
                'sale_mode' => 'unit',
                'content_quantity' => 100,
                'content_unit_id' => $this->grams->id,
                'base_price' => 2,
            ],
        ],
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.name', 'Arroz Extra')
        ->assertJsonCount(2, 'data.variants')
        ->assertJsonPath('data.variants.0.display_name', 'Arroz Extra - Granel')
        ->assertJsonPath('data.variants.0.sale_mode', 'measured')
        ->assertJsonPath('data.variants.0.price_tiers.0.unit_price', '0.0100')
        ->assertJsonPath('data.variants.1.sale_mode', 'unit')
        ->assertJsonPath('data.variants.1.content_quantity', '100.000000')
        ->assertJsonPath('data.variants.1.price_tiers.0.unit_price', '2.0000');

    $this->assertDatabaseHas('products', [
        'sku' => 'ARROZ-100G',
        'sale_mode' => 'unit',
        'content_quantity' => 100,
    ]);
    $this->assertDatabaseHas('products', [
        'sku' => 'ARROZ-GRANEL',
        'sale_mode' => 'measured',
    ]);
});

it('lists one template instead of duplicating the family for every variant', function (): void {
    $template = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Pecanas',
        'variants' => [
            [
                'variant_name' => '100 g',
                'sku' => 'PEC-100',
                'base_unit_id' => $this->units->id,
                'sale_mode' => 'unit',
                'content_quantity' => 100,
                'content_unit_id' => $this->grams->id,
                'base_price' => 3,
            ],
            [
                'variant_name' => '250 g',
                'sku' => 'PEC-250',
                'base_unit_id' => $this->units->id,
                'sale_mode' => 'unit',
                'content_quantity' => 250,
                'content_unit_id' => $this->grams->id,
                'base_price' => 6,
            ],
        ],
    ])->assertCreated()->json('data');

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/product-templates')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $template['id'])
        ->assertJsonCount(2, 'data.0.variants');
});

it('updates the base price without destroying the existing quantity ranges', function (): void {
    $template = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Arroz Extra',
        'variants' => [
            [
                'variant_name' => 'Granel',
                'sku' => 'ARROZ-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'price_tiers' => [
                    [
                        'label' => 'Menudeo',
                        'min_quantity' => 250,
                        'max_quantity' => 999,
                        'unit_price' => 0.01,
                    ],
                    [
                        'label' => 'Kilo',
                        'min_quantity' => 1000,
                        'max_quantity' => 50000,
                        'unit_price' => 0.008,
                    ],
                ],
            ],
        ],
    ])->assertCreated()->json('data');

    $variant = $template['variants'][0];

    $this->withHeaders($this->headers)->putJson("/api/v1/product-templates/{$template['id']}", [
        'name' => 'Arroz Extra',
        'variants' => [
            [
                'id' => $variant['id'],
                'variant_name' => 'Granel',
                'sku' => 'ARROZ-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'base_price' => 0.012,
            ],
        ],
    ])->assertOk();

    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $variant['id'],
        'label' => 'Menudeo',
        'min_quantity' => 250,
        'max_quantity' => 999,
        'unit_price' => 0.012,
    ]);
    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $variant['id'],
        'label' => 'Kilo',
        'min_quantity' => 1000,
        'max_quantity' => 50000,
        'unit_price' => 0.008,
    ]);
});

it('creates the cartesian product of two attributes as independently priced products', function (): void {
    $combinations = [
        ['250 g', 'Rojo', 'ARR-250-R', '7751000000001', 2.5],
        ['250 g', 'Azul', 'ARR-250-A', '7751000000002', 2.7],
        ['1 kg', 'Rojo', 'ARR-1K-R', '7751000000003', 8.5],
        ['1 kg', 'Azul', 'ARR-1K-A', '7751000000004', 8.8],
    ];

    $response = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Arroz Premium',
        'attributes' => [
            [
                'name' => 'Peso',
                'values' => ['250 g', '1 kg'],
                'value_prices' => ['250 g' => 2.5, '1 kg' => 8.5],
                'value_factors' => ['250 g' => 250, '1 kg' => 1000],
            ],
            [
                'name' => 'Color',
                'values' => ['Rojo', 'Azul'],
                'value_prices' => ['Rojo' => 0, 'Azul' => 0.3],
            ],
        ],
        'variants' => [
            [
                'variant_name' => 'Granel',
                'sku' => 'ARR-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'is_principal' => true,
                'base_price' => 0.01,
                'attribute_values' => [],
            ],
            ...array_map(
                fn (array $combination): array => [
                    'variant_name' => "{$combination[0]} / {$combination[1]}",
                    'sku' => $combination[2],
                    'barcode' => $combination[3],
                    'base_unit_id' => $this->units->id,
                    'sale_mode' => 'unit',
                    'base_price' => $combination[4],
                    'attribute_values' => [
                        ['attribute' => 'Peso', 'value' => $combination[0]],
                        ['attribute' => 'Color', 'value' => $combination[1]],
                    ],
                ],
                $combinations,
            ),
        ],
    ]);

    $response->assertCreated()
        ->assertJsonCount(2, 'data.attributes')
        ->assertJsonCount(5, 'data.variants')
        ->assertJsonPath('data.variants.0.variant_name', 'Granel')
        ->assertJsonPath('data.variants.0.is_principal', true)
        ->assertJsonCount(0, 'data.variants.0.attribute_values')
        ->assertJsonPath('data.attributes.0.name', 'Peso')
        ->assertJsonPath('data.attributes.0.values.0.price', '2.5000')
        ->assertJsonPath('data.attributes.0.values.0.factor', '250.000000')
        ->assertJsonPath('data.attributes.0.values.1.price', '8.5000')
        ->assertJsonPath('data.attributes.0.values.1.factor', '1000.000000')
        ->assertJsonPath('data.attributes.1.name', 'Color')
        ->assertJsonPath('data.attributes.1.values.1.price', '0.3000')
        ->assertJsonPath('data.variants.4.sku', 'ARR-1K-A')
        ->assertJsonPath('data.variants.4.barcode', '7751000000004')
        ->assertJsonPath('data.variants.4.price_tiers.0.unit_price', '8.8000')
        ->assertJsonCount(2, 'data.variants.4.attribute_values');

    $this->assertDatabaseCount('product_attributes', 2);
    $this->assertDatabaseCount('product_attribute_values', 4);
    $this->assertDatabaseCount('product_attribute_value_product', 8);
});

it('rejects changing the unit of a variant that already has operational history', function (): void {
    $template = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Azúcar',
        'variants' => [
            [
                'variant_name' => 'Granel',
                'sku' => 'AZUCAR-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'is_principal' => true,
                'base_price' => 0.005,
            ],
        ],
    ])->assertCreated()->json('data');
    $variant = $template['variants'][0];
    InventoryMovement::factory()->create(['product_id' => $variant['id']]);

    $response = $this->withHeaders($this->headers)->putJson(
        "/api/v1/product-templates/{$template['id']}",
        [
            'name' => 'Azúcar',
            'variants' => [
                [
                    'id' => $variant['id'],
                    'variant_name' => 'Granel',
                    'sku' => 'AZUCAR-GRANEL',
                    'base_unit_id' => $this->units->id,
                    'sale_mode' => 'unit',
                    'is_principal' => true,
                    'base_price' => 0.005,
                ],
            ],
        ],
    );

    $response->assertUnprocessable()->assertJsonValidationErrors('variants.0.base_unit_id');
    $this->assertDatabaseHas('products', [
        'id' => $variant['id'],
        'base_unit_id' => $this->grams->id,
        'sale_mode' => 'measured',
    ]);
});

it('rejects reusing a historical variant for a different attribute combination', function (): void {
    $template = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Café',
        'attributes' => [
            ['name' => 'Peso', 'values' => ['250 g', '1 kg']],
        ],
        'variants' => [
            [
                'variant_name' => 'Granel',
                'sku' => 'CAFE-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'is_principal' => true,
                'base_price' => 0.04,
                'attribute_values' => [],
            ],
            [
                'variant_name' => '250 g',
                'sku' => 'CAFE-250',
                'base_unit_id' => $this->units->id,
                'sale_mode' => 'unit',
                'content_quantity' => 250,
                'content_unit_id' => $this->grams->id,
                'base_price' => 10,
                'attribute_values' => [
                    ['attribute' => 'Peso', 'value' => '250 g'],
                ],
            ],
        ],
    ])->assertCreated()->json('data');
    $principal = $template['variants'][0];
    $packaged = $template['variants'][1];
    InventoryMovement::factory()->create(['product_id' => $packaged['id']]);

    $response = $this->withHeaders($this->headers)->putJson(
        "/api/v1/product-templates/{$template['id']}",
        [
            'name' => 'Café',
            'attributes' => [
                ['name' => 'Peso', 'values' => ['250 g', '1 kg']],
            ],
            'variants' => [
                [
                    'id' => $principal['id'],
                    'variant_name' => 'Granel',
                    'sku' => 'CAFE-GRANEL',
                    'base_unit_id' => $this->grams->id,
                    'sale_mode' => 'measured',
                    'is_principal' => true,
                    'base_price' => 0.04,
                    'attribute_values' => [],
                ],
                [
                    'id' => $packaged['id'],
                    'variant_name' => '1 kg',
                    'sku' => 'CAFE-250',
                    'base_unit_id' => $this->units->id,
                    'sale_mode' => 'unit',
                    'content_quantity' => 250,
                    'content_unit_id' => $this->grams->id,
                    'base_price' => 30,
                    'attribute_values' => [
                        ['attribute' => 'Peso', 'value' => '1 kg'],
                    ],
                ],
            ],
        ],
    );

    $response->assertUnprocessable()->assertJsonValidationErrors('variants.1.attribute_values');
    $this->assertDatabaseHas('products', [
        'id' => $packaged['id'],
        'variant_name' => '250 g',
        'content_quantity' => 250,
    ]);
});

it('normalizes legacy principal attributes back to granel without moving its history', function (): void {
    $template = ProductTemplate::query()->create([
        'name' => 'Aceite vegetal',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $principal = Product::factory()->create([
        'product_template_id' => $template->id,
        'variant_name' => '1 L',
        'sku' => 'ACEITE-GRANEL',
        'base_unit_id' => $this->grams->id,
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    $attribute = ProductAttribute::query()->create(['name' => 'Presentación']);
    $value = $attribute->values()->create(['value' => '1 L']);
    $template->attributeValues()->attach($value->id, ['position' => 0]);
    $principal->attributeValues()->attach($value->id);
    InventoryMovement::factory()->create(['product_id' => $principal->id]);

    $response = $this->withHeaders($this->headers)->putJson(
        "/api/v1/product-templates/{$template->id}",
        [
            'name' => 'Aceite vegetal',
            'attributes' => [
                ['name' => 'Presentación', 'values' => ['1 L']],
            ],
            'variants' => [
                [
                    'id' => $principal->id,
                    'variant_name' => 'Granel',
                    'sku' => 'ACEITE-GRANEL',
                    'base_unit_id' => $this->grams->id,
                    'sale_mode' => 'measured',
                    'is_principal' => true,
                    'attribute_values' => [],
                ],
            ],
        ],
    );

    $response->assertOk()
        ->assertJsonPath('data.variants.0.id', $principal->id)
        ->assertJsonPath('data.variants.0.variant_name', 'Granel')
        ->assertJsonCount(0, 'data.variants.0.attribute_values');
    $this->assertDatabaseHas('inventory_movements', ['product_id' => $principal->id]);
    $this->assertDatabaseMissing('product_attribute_value_product', [
        'product_id' => $principal->id,
    ]);
});

it('does not allow omitting the protected principal variant', function (): void {
    $template = $this->withHeaders($this->headers)->postJson('/api/v1/product-templates', [
        'name' => 'Quinua',
        'variants' => [
            [
                'variant_name' => 'Granel',
                'sku' => 'QUINUA-GRANEL',
                'base_unit_id' => $this->grams->id,
                'sale_mode' => 'measured',
                'is_principal' => true,
                'base_price' => 0.02,
            ],
        ],
    ])->assertCreated()->json('data');

    $this->withHeaders($this->headers)->putJson(
        "/api/v1/product-templates/{$template['id']}",
        [
            'name' => 'Quinua',
            'variants' => [
                [
                    'variant_name' => 'Bolsa',
                    'sku' => 'QUINUA-BOLSA',
                    'base_unit_id' => $this->units->id,
                    'sale_mode' => 'unit',
                    'content_quantity' => 1000,
                    'content_unit_id' => $this->grams->id,
                    'base_price' => 10,
                ],
            ],
        ],
    )->assertUnprocessable()->assertJsonValidationErrors('variants');
});
