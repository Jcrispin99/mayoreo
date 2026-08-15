<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_templates', function (Blueprint $table): void {
            $table->dropColumn('default_price');
        });
    }

    public function down(): void
    {
        Schema::table('product_templates', function (Blueprint $table): void {
            $table->decimal('default_price', 12, 4)->nullable()->after('description');
        });
    }
};
