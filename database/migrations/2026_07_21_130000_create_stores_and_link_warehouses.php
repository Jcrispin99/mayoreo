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
        Schema::create('stores', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('address')->nullable();
            $table->string('phone', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('warehouses', function (Blueprint $table): void {
            $table->foreignId('store_id')->nullable()->after('id')->constrained('stores')->restrictOnDelete();
            $table->boolean('is_default')->default(false)->after('type');
        });

        if (DB::table('warehouses')->exists()) {
            $now = now();
            $storeId = DB::table('stores')->insertGetId([
                'code' => 'PRINCIPAL',
                'name' => 'Tienda principal',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('warehouses')->update(['store_id' => $storeId]);

            $defaultWarehouseId = DB::table('warehouses')->where('code', 'MAIN')->value('id')
                ?? DB::table('warehouses')->orderBy('id')->value('id');

            if ($defaultWarehouseId !== null) {
                DB::table('warehouses')->where('id', $defaultWarehouseId)->update(['is_default' => true]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('store_id');
            $table->dropColumn('is_default');
        });

        Schema::dropIfExists('stores');
    }
};
