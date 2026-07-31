<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_attributes', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique('name');
        });

        Schema::create('product_attribute_values', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_attribute_id')
                ->constrained('product_attributes')
                ->cascadeOnDelete();
            $table->string('value');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['product_attribute_id', 'value']);
        });

        Schema::create('product_template_attribute_value', function (Blueprint $table): void {
            $table->foreignId('product_template_id')
                ->constrained('product_templates')
                ->cascadeOnDelete();
            $table->foreignId('product_attribute_value_id')
                ->constrained('product_attribute_values')
                ->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->primary(
                ['product_template_id', 'product_attribute_value_id'],
                'template_attribute_value_primary',
            );
        });

        Schema::create('product_attribute_value_product', function (Blueprint $table): void {
            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->foreignId('product_attribute_value_id')
                ->constrained('product_attribute_values')
                ->cascadeOnDelete();
            $table->primary(
                ['product_id', 'product_attribute_value_id'],
                'product_attribute_value_product_primary',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_attribute_value_product');
        Schema::dropIfExists('product_template_attribute_value');
        Schema::dropIfExists('product_attribute_values');
        Schema::dropIfExists('product_attributes');
    }
};
