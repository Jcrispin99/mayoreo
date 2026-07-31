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
        Schema::create('product_templates', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('default_price', 12, 4)->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_pos_visible')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->foreignId('product_template_id')
                ->nullable()
                ->after('id')
                ->constrained('product_templates')
                ->restrictOnDelete();
            $table->string('variant_name')->nullable()->after('name');
            $table->enum('sale_mode', ['unit', 'measured'])->default('unit')->after('base_unit_id');
            $table->decimal('content_quantity', 18, 6)->nullable()->after('sale_mode');
            $table->foreignId('content_unit_id')
                ->nullable()
                ->after('content_quantity')
                ->constrained('units_of_measure')
                ->restrictOnDelete();
            $table->boolean('is_principal')->default(false)->after('is_favorite');
            $table->index(['product_template_id', 'is_active']);
        });

        $products = DB::table('products')
            ->leftJoin('units_of_measure', 'units_of_measure.id', '=', 'products.base_unit_id')
            ->select([
                'products.id',
                'products.name',
                'products.description',
                'products.image_path',
                'products.is_active',
                'units_of_measure.type as unit_type',
            ])
            ->orderBy('products.id')
            ->get();

        foreach ($products as $product) {
            $defaultPrice = DB::table('price_tiers')
                ->where('product_id', $product->id)
                ->where('is_active', true)
                ->orderBy('min_quantity')
                ->value('unit_price');

            $templateId = DB::table('product_templates')->insertGetId([
                'name' => $product->name,
                'description' => $product->description,
                'default_price' => $defaultPrice,
                'image_path' => $product->image_path,
                'is_active' => $product->is_active,
                'is_pos_visible' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('products')
                ->where('id', $product->id)
                ->update([
                    'product_template_id' => $templateId,
                    'sale_mode' => $product->unit_type === 'count' ? 'unit' : 'measured',
                    'is_principal' => true,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['product_template_id']);
            $table->dropForeign(['content_unit_id']);
            $table->dropIndex(['product_template_id', 'is_active']);
            $table->dropColumn([
                'product_template_id',
                'variant_name',
                'sale_mode',
                'content_quantity',
                'content_unit_id',
                'is_principal',
            ]);
        });

        Schema::dropIfExists('product_templates');
    }
};
