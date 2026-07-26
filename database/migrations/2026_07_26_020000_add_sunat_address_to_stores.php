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
        Schema::table('stores', function (Blueprint $table): void {
            $table->string('sunat_address')->nullable()->after('sunat_establishment_code');
            $table->char('sunat_ubigeo', 6)->nullable()->after('sunat_address');
            $table->string('sunat_urbanization', 100)->nullable()->after('sunat_ubigeo');
            $table->string('sunat_department', 100)->nullable()->after('sunat_urbanization');
            $table->string('sunat_province', 100)->nullable()->after('sunat_department');
            $table->string('sunat_district', 100)->nullable()->after('sunat_province');
        });

        $stores = DB::table('stores')
            ->join('fiscal_issuers', 'fiscal_issuers.id', '=', 'stores.fiscal_issuer_id')
            ->select([
                'stores.id',
                'stores.address',
                'fiscal_issuers.fiscal_address',
                'fiscal_issuers.ubigeo',
                'fiscal_issuers.urbanization',
                'fiscal_issuers.department',
                'fiscal_issuers.province',
                'fiscal_issuers.district',
            ])
            ->get();

        foreach ($stores as $store) {
            DB::table('stores')
                ->where('id', $store->id)
                ->update([
                    'sunat_address' => $store->address ?? $store->fiscal_address,
                    'sunat_ubigeo' => $store->ubigeo,
                    'sunat_urbanization' => $store->urbanization,
                    'sunat_department' => $store->department,
                    'sunat_province' => $store->province,
                    'sunat_district' => $store->district,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table): void {
            $table->dropColumn([
                'sunat_address',
                'sunat_ubigeo',
                'sunat_urbanization',
                'sunat_department',
                'sunat_province',
                'sunat_district',
            ]);
        });
    }
};
