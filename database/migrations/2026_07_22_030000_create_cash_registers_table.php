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
        Schema::create('cash_registers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained('stores')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('default_sales_series_id')->nullable()->constrained('document_series')->restrictOnDelete();
            $table->string('code', 50);
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['store_id', 'code']);
        });

        Schema::create('cash_register_document_series', function (Blueprint $table): void {
            $table->foreignId('cash_register_id')->constrained('cash_registers')->cascadeOnDelete();
            $table->foreignId('document_series_id')->constrained('document_series')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['cash_register_id', 'document_series_id']);
            $table->unique('document_series_id');
        });

        $storeId = DB::table('stores')->where('code', 'PRINCIPAL')->where('is_active', true)->value('id')
            ?? DB::table('stores')->where('is_active', true)->orderBy('id')->value('id');

        if ($storeId === null) {
            return;
        }

        $warehouseId = DB::table('warehouses')
            ->where('store_id', $storeId)
            ->where('is_active', true)
            ->orderByRaw("case when type = 'pos' then 0 when is_default = 1 then 1 else 2 end")
            ->orderBy('id')
            ->value('id');

        if ($warehouseId === null) {
            return;
        }

        $salesSeriesId = DB::table('document_series')
            ->whereIn('document_type', ['sales_ticket', 'receipt', 'invoice'])
            ->where('is_active', true)
            ->orderByRaw("case when series_code = 'NV01' then 0 else 1 end")
            ->orderBy('id')
            ->value('id');

        $now = now();
        $cashRegisterId = DB::table('cash_registers')->insertGetId([
            'store_id' => $storeId,
            'warehouse_id' => $warehouseId,
            'default_sales_series_id' => $salesSeriesId,
            'code' => 'CAJA-01',
            'name' => 'Caja principal',
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($salesSeriesId !== null) {
            DB::table('cash_register_document_series')->insert([
                'cash_register_id' => $cashRegisterId,
                'document_series_id' => $salesSeriesId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

    }

    public function down(): void
    {
        if (Schema::hasColumn('document_series', 'cash_register_id')) {
            Schema::table('document_series', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('cash_register_id');
            });
        }

        Schema::dropIfExists('cash_register_document_series');
        Schema::dropIfExists('cash_registers');
    }
};
