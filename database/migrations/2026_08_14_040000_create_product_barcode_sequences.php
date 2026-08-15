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
        $currentNumber = 0;
        foreach (DB::table('products')->whereNotNull('barcode')->pluck('barcode') as $barcode) {
            if (! is_string($barcode) || preg_match('/^\d{6}$/D', $barcode) !== 1) {
                continue;
            }

            $currentNumber = max($currentNumber, (int) $barcode);
        }

        Schema::create('product_barcode_sequences', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->unsignedInteger('current_number');
        });

        DB::table('product_barcode_sequences')->insert([
            'id' => 1,
            'current_number' => $currentNumber,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('product_barcode_sequences');
    }
};
