<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productables', function (Blueprint $table): void {
            $table->foreignId('stock_product_id')
                ->nullable()
                ->after('product_id')
                ->constrained('products')
                ->restrictOnDelete();
            $table->decimal('stock_quantity', 18, 6)
                ->nullable()
                ->after('quantity');
            $table->index(['stock_product_id', 'productable_type']);
        });

        DB::table('productables')
            ->where('productable_type', 'App\\Models\\Sale')
            ->update([
                'stock_product_id' => DB::raw('product_id'),
                'stock_quantity' => DB::raw('quantity'),
            ]);
    }

    public function down(): void
    {
        Schema::table('productables', function (Blueprint $table): void {
            $table->dropForeign(['stock_product_id']);
            $table->dropIndex(['stock_product_id', 'productable_type']);
            $table->dropColumn(['stock_product_id', 'stock_quantity']);
        });
    }
};
