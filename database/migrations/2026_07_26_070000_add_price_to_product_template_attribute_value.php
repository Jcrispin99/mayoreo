<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_template_attribute_value', function (Blueprint $table): void {
            $table->decimal('price', 14, 4)->default(0)->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('product_template_attribute_value', function (Blueprint $table): void {
            $table->dropColumn('price');
        });
    }
};
