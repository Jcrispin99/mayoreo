<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('purchase_orders')
            ->whereNull('invoice_series')
            ->whereNotNull('invoice_number')
            ->orderBy('id')
            ->each(function (object $order): void {
                $separator = mb_strpos((string) $order->invoice_number, '-');
                if ($separator === false) {
                    return;
                }

                $series = mb_substr((string) $order->invoice_number, 0, $separator);
                $number = mb_substr((string) $order->invoice_number, $separator + 1);
                if ($series === '' || $number === '') {
                    return;
                }

                DB::table('purchase_orders')->where('id', $order->id)->update([
                    'invoice_series' => $series,
                    'invoice_number' => $number,
                ]);
            });
    }

    public function down(): void
    {
        DB::table('purchase_orders')
            ->whereNotNull('invoice_series')
            ->whereNotNull('invoice_number')
            ->orderBy('id')
            ->each(function (object $order): void {
                DB::table('purchase_orders')->where('id', $order->id)->update([
                    'invoice_number' => "{$order->invoice_series}-{$order->invoice_number}",
                    'invoice_series' => null,
                ]);
            });
    }
};
