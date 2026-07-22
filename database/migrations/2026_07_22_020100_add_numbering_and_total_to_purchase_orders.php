<?php

declare(strict_types=1);

use App\Models\PurchaseOrder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table): void {
            $table->string('series_code', 20)->nullable()->after('id');
            $table->unsignedBigInteger('number')->nullable()->after('series_code');
            $table->string('invoice_series', 20)->nullable()->after('ordered_at');
            $table->decimal('total', 14, 4)->default(0)->after('invoice_number');
            $table->unique(['series_code', 'number']);
        });

        $series = DB::table('document_series')
            ->where('document_type', 'purchase')
            ->where('series_code', 'OC01')
            ->first();
        $number = (int) ($series->current_number ?? 0);

        DB::table('purchase_orders')->orderBy('id')->each(function (object $order) use (&$number): void {
            $number++;
            $total = DB::table('productables')
                ->where('productable_type', PurchaseOrder::class)
                ->where('productable_id', $order->id)
                ->selectRaw('COALESCE(SUM(quantity_purchased * unit_cost), 0) AS total')
                ->value('total');

            DB::table('purchase_orders')->where('id', $order->id)->update([
                'series_code' => 'OC01',
                'number' => $number,
                'total' => $total ?? 0,
            ]);
        });

        DB::table('document_series')
            ->where('document_type', 'purchase')
            ->where('series_code', 'OC01')
            ->update(['current_number' => $number, 'updated_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table): void {
            $table->dropUnique(['series_code', 'number']);
            $table->dropColumn(['series_code', 'number', 'invoice_series', 'total']);
        });
    }
};
