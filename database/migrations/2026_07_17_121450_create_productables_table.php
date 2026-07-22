<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('productables', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->morphs('productable');

            $table->decimal('quantity', 18, 6);

            // Solo compras (PurchaseOrder)
            $table->foreignId('product_purchase_unit_id')->nullable()->constrained('product_purchase_units')->restrictOnDelete();
            $table->decimal('quantity_purchased', 18, 6)->nullable();

            // Solo ventas (Sale)
            $table->decimal('input_quantity', 18, 6)->nullable();
            $table->foreignId('input_unit_id')->nullable()->constrained('units_of_measure')->restrictOnDelete();
            $table->foreignId('price_tier_id')->nullable()->constrained('price_tiers')->nullOnDelete();
            $table->decimal('unit_price', 12, 4)->nullable();
            $table->decimal('line_total', 14, 4)->nullable();

            // Compras y transferencias (InventoryTransfer)
            $table->decimal('unit_cost', 12, 4)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('productables');
    }
};
