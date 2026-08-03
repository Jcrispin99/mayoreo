<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_orders', function (Blueprint $table): void {
            $table->text('warehouse_notes')->nullable()->after('status');
        });

        Schema::table('productables', function (Blueprint $table): void {
            $table->text('warehouse_notes')->nullable()->after('quantity');
        });

        Schema::table('pos_supply_requests', function (Blueprint $table): void {
            $table->text('warehouse_notes')->nullable()->after('status');
            $table->unsignedInteger('warehouse_notes_changed_version')->default(1)->after('acknowledged_version');
        });

        Schema::table('pos_supply_request_items', function (Blueprint $table): void {
            $table->text('warehouse_notes')->nullable()->after('prepared_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('pos_supply_request_items', function (Blueprint $table): void {
            $table->dropColumn('warehouse_notes');
        });

        Schema::table('pos_supply_requests', function (Blueprint $table): void {
            $table->dropColumn(['warehouse_notes', 'warehouse_notes_changed_version']);
        });

        Schema::table('productables', function (Blueprint $table): void {
            $table->dropColumn('warehouse_notes');
        });

        Schema::table('pos_orders', function (Blueprint $table): void {
            $table->dropColumn('warehouse_notes');
        });
    }
};
