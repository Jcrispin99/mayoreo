<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_transfers', function (Blueprint $table): void {
            $table->foreignId('pos_order_id')->nullable()->after('to_warehouse_id')
                ->constrained('pos_orders')->nullOnDelete();
            $table->index(['pos_order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transfers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('pos_order_id');
        });
    }
};
