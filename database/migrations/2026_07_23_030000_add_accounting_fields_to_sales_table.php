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
        Schema::table('sales', function (Blueprint $table): void {
            $table->foreignId('customer_id')
                ->nullable()
                ->after('pos_order_id')
                ->constrained('customers')
                ->restrictOnDelete();
            $table->string('source', 20)->default('wholesale')->after('customer_id');
            $table->text('notes')->nullable()->after('customer_document');

            $table->index(['source', 'sold_at'], 'sales_source_sold_at_index');
            $table->index(['status', 'sold_at'], 'sales_status_sold_at_index');
        });

        DB::table('sales')
            ->whereNotNull('pos_order_id')
            ->update(['source' => 'pos']);

        Schema::table('sale_payments', function (Blueprint $table): void {
            $table->foreignId('cash_register_session_id')->nullable()->change();
            $table->index(['method', 'paid_at'], 'sale_payments_method_paid_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('sale_payments', function (Blueprint $table): void {
            $table->dropIndex('sale_payments_method_paid_at_index');
            $table->foreignId('cash_register_session_id')->nullable(false)->change();
        });

        Schema::table('sales', function (Blueprint $table): void {
            $table->dropIndex('sales_source_sold_at_index');
            $table->dropIndex('sales_status_sold_at_index');
            $table->dropForeign(['customer_id']);
            $table->dropColumn(['customer_id', 'source', 'notes']);
        });
    }
};
