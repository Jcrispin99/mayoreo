<?php

declare(strict_types=1);

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('generates a unique six digit barcode when a product has none', function (): void {
    $first = Product::factory()->create(['barcode' => null]);
    $second = Product::factory()->create(['barcode' => null]);

    expect($first->barcode)
        ->toMatch('/^\d{6}$/D')
        ->toBe('000001')
        ->and($second->barcode)
        ->toMatch('/^\d{6}$/D')
        ->toBe('000002')
        ->not->toBe($first->barcode);
});

it('does not reuse a generated code held by a soft deleted product', function (): void {
    $deleted = Product::factory()->create(['barcode' => '000001']);
    $deleted->delete();

    $product = Product::factory()->create(['barcode' => null]);

    expect($product->barcode)->toBe('000002');
});

it('preserves an explicitly supplied commercial barcode', function (): void {
    $product = Product::factory()->create(['barcode' => '7501234567890']);

    expect($product->barcode)->toBe('7501234567890');
});
