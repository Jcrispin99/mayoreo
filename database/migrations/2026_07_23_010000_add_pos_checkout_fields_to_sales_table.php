<?php

declare(strict_types=1);

use App\Models\Sale;
use App\Services\MoneyService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->foreignId('cash_register_session_id')
                ->nullable()
                ->after('warehouse_id')
                ->constrained('cash_register_sessions')
                ->restrictOnDelete();
            $table->foreignId('pos_order_id')
                ->nullable()
                ->after('cash_register_session_id')
                ->constrained('pos_orders')
                ->restrictOnDelete();
            $table->decimal('payable_total', 14, 2)->nullable()->after('total');

            $table->unique('pos_order_id');
        });

        $moneyService = new MoneyService;

        Sale::query()
            ->select(['id', 'total'])
            ->eachById(static function (Sale $sale, int $_index) use ($moneyService): void {
                /** @var numeric-string $total */
                $total = $sale->total;

                $sale->updateQuietly([
                    'payable_total' => $moneyService->roundHalfUp($total),
                ]);
            });

        Schema::table('sales', function (Blueprint $table): void {
            $table->decimal('payable_total', 14, 2)
                ->nullable(false)
                ->after('total')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->dropForeign(['cash_register_session_id']);
            $table->dropForeign(['pos_order_id']);
            $table->dropUnique(['pos_order_id']);
            $table->dropColumn([
                'cash_register_session_id',
                'pos_order_id',
                'payable_total',
            ]);
        });
    }
};
