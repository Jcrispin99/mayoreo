<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_product_prices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_purchase_unit_id')->nullable()->constrained('product_purchase_units')->restrictOnDelete();
            $table->decimal('unit_cost', 14, 4);
            $table->date('quoted_at');
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['supplier_id', 'product_id']);
            $table->index(['product_id', 'quoted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_product_prices');
    }
};
