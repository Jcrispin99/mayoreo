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
            $table->string('product_sku_snapshot')->nullable()->after('product_id');
            $table->string('product_name_snapshot')->nullable()->after('product_sku_snapshot');
            $table->string('unit_code_snapshot', 20)->nullable()->after('product_name_snapshot');
            $table->string('base_unit_code_snapshot', 20)->nullable()->after('unit_code_snapshot');
        });

        DB::table('productables')
            ->where('productable_type', App\Models\Sale::class)
            ->orderBy('id')
            ->chunkById(500, static function ($items): void {
                $products = DB::table('products')
                    ->whereIn('id', $items->pluck('product_id')->unique())
                    ->get(['id', 'sku', 'name', 'base_unit_id'])
                    ->keyBy('id');
                $units = DB::table('units_of_measure')
                    ->whereIn('id', $items->pluck('input_unit_id')->merge($products->pluck('base_unit_id'))->filter()->unique())
                    ->get(['id', 'code'])
                    ->keyBy('id');

                foreach ($items as $item) {
                    if (! is_numeric($item->id) || ! is_numeric($item->product_id)) {
                        continue;
                    }

                    $itemId = (int) $item->id;
                    $productId = (int) $item->product_id;
                    $inputUnitId = is_numeric($item->input_unit_id) ? (int) $item->input_unit_id : null;
                    $product = $products->get($productId);
                    $unit = $inputUnitId === null ? null : $units->get($inputUnitId);
                    $baseUnitId = is_numeric($product?->base_unit_id) ? (int) $product->base_unit_id : null;

                    DB::table('productables')->where('id', $itemId)->update([
                        'product_sku_snapshot' => $product?->sku,
                        'product_name_snapshot' => $product?->name,
                        'unit_code_snapshot' => $unit?->code,
                        'base_unit_code_snapshot' => $baseUnitId === null ? null : $units->get($baseUnitId)?->code,
                    ]);
                }
            });

        Schema::create('fiscal_document_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fiscal_document_id')->constrained('fiscal_documents')->cascadeOnDelete();
            $table->string('channel', 20);
            $table->string('destination', 30);
            $table->string('access_token', 64)->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('opened_at')->nullable();
            $table->timestamps();

            $table->index(['fiscal_document_id', 'created_at']);
            $table->index(['channel', 'destination']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_document_deliveries');

        Schema::table('productables', function (Blueprint $table): void {
            $table->dropColumn([
                'product_sku_snapshot',
                'product_name_snapshot',
                'unit_code_snapshot',
                'base_unit_code_snapshot',
            ]);
        });
    }
};
