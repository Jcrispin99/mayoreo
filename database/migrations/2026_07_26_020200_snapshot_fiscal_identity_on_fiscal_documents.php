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
        Schema::table('fiscal_documents', function (Blueprint $table): void {
            $table->dropUnique('fiscal_documents_document_type_series_code_number_unique');
            $table->foreignId('fiscal_issuer_id')
                ->nullable()
                ->after('sale_id')
                ->constrained('fiscal_issuers')
                ->restrictOnDelete();
            $table->unsignedBigInteger('fiscal_scope_id')
                ->virtualAs('COALESCE(fiscal_issuer_id, 0)')
                ->after('fiscal_issuer_id');
            $table->foreignId('store_id')
                ->nullable()
                ->after('fiscal_scope_id')
                ->constrained('stores')
                ->nullOnDelete();
            $table->char('issuer_ruc', 11)->nullable()->after('store_id');
            $table->string('issuer_legal_name')->nullable()->after('issuer_ruc');
            $table->string('issuer_trade_name')->nullable()->after('issuer_legal_name');
            $table->char('establishment_code', 4)->nullable()->after('issuer_trade_name');
            $table->string('establishment_address')->nullable()->after('establishment_code');
            $table->char('establishment_ubigeo', 6)->nullable()->after('establishment_address');
            $table->string('establishment_urbanization', 100)->nullable()->after('establishment_ubigeo');
            $table->string('establishment_department', 100)->nullable()->after('establishment_urbanization');
            $table->string('establishment_province', 100)->nullable()->after('establishment_department');
            $table->string('establishment_district', 100)->nullable()->after('establishment_province');
            $table->unique(
                ['fiscal_scope_id', 'document_type', 'series_code', 'number'],
                'fiscal_documents_issuer_type_series_number_unique',
            );
        });

        $documents = DB::table('fiscal_documents')
            ->join('sales', 'sales.id', '=', 'fiscal_documents.sale_id')
            ->join('warehouses', 'warehouses.id', '=', 'sales.warehouse_id')
            ->join('stores', 'stores.id', '=', 'warehouses.store_id')
            ->join('fiscal_issuers', 'fiscal_issuers.id', '=', 'stores.fiscal_issuer_id')
            ->select([
                'fiscal_documents.id',
                'fiscal_documents.document_type',
                'fiscal_documents.series_code',
                'stores.id as store_id',
                'stores.fiscal_issuer_id',
                'stores.sunat_establishment_code',
                'stores.sunat_address',
                'stores.sunat_ubigeo',
                'stores.sunat_urbanization',
                'stores.sunat_department',
                'stores.sunat_province',
                'stores.sunat_district',
                'fiscal_issuers.ruc',
                'fiscal_issuers.legal_name',
                'fiscal_issuers.trade_name',
            ])
            ->get();

        foreach ($documents as $document) {
            DB::table('fiscal_documents')
                ->where('id', $document->id)
                ->update([
                    'fiscal_issuer_id' => $document->fiscal_issuer_id,
                    'store_id' => $document->store_id,
                    'issuer_ruc' => $document->ruc,
                    'issuer_legal_name' => $document->legal_name,
                    'issuer_trade_name' => $document->trade_name,
                    'establishment_code' => $document->sunat_establishment_code,
                    'establishment_address' => $document->sunat_address,
                    'establishment_ubigeo' => $document->sunat_ubigeo,
                    'establishment_urbanization' => $document->sunat_urbanization,
                    'establishment_department' => $document->sunat_department,
                    'establishment_province' => $document->sunat_province,
                    'establishment_district' => $document->sunat_district,
                ]);
        }

        $seriesGroups = DB::table('fiscal_documents')
            ->whereNotNull('fiscal_issuer_id')
            ->select([
                'fiscal_issuer_id',
                'document_type',
                'series_code',
            ])
            ->selectRaw('MAX(number) as max_number')
            ->groupBy([
                'fiscal_issuer_id',
                'document_type',
                'series_code',
            ])
            ->get();

        foreach ($seriesGroups as $group) {
            $seriesId = DB::table('document_series')
                ->where('fiscal_issuer_id', $group->fiscal_issuer_id)
                ->where('document_type', $group->document_type)
                ->where('series_code', $group->series_code)
                ->value('id');

            if (! is_numeric($seriesId)) {
                $legacySeries = DB::table('document_series')
                    ->whereNull('fiscal_issuer_id')
                    ->where('document_type', $group->document_type)
                    ->where('series_code', $group->series_code)
                    ->first();

                if ($legacySeries !== null) {
                    $seriesId = $legacySeries->id;

                    DB::table('document_series')
                        ->where('id', $seriesId)
                        ->update(['fiscal_issuer_id' => $group->fiscal_issuer_id]);
                } else {
                    $template = DB::table('document_series')
                        ->where('document_type', $group->document_type)
                        ->where('series_code', $group->series_code)
                        ->first();
                    $now = now();
                    $seriesId = DB::table('document_series')->insertGetId([
                        'fiscal_issuer_id' => $group->fiscal_issuer_id,
                        'document_type' => $group->document_type,
                        'series_code' => $group->series_code,
                        'current_number' => 0,
                        'is_active' => $template->is_active ?? true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            $currentNumber = DB::table('document_series')
                ->where('id', $seriesId)
                ->value('current_number');
            $maximumIssuedNumber = is_numeric($group->max_number)
                ? (int) $group->max_number
                : 0;

            if (! is_numeric($currentNumber) || (int) $currentNumber < $maximumIssuedNumber) {
                DB::table('document_series')
                    ->where('id', $seriesId)
                    ->update([
                        'current_number' => $maximumIssuedNumber,
                        'updated_at' => now(),
                    ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table): void {
            $table->dropUnique('fiscal_documents_issuer_type_series_number_unique');
            $table->dropColumn('fiscal_scope_id');
            $table->dropConstrainedForeignId('fiscal_issuer_id');
            $table->dropConstrainedForeignId('store_id');
            $table->dropColumn([
                'issuer_ruc',
                'issuer_legal_name',
                'issuer_trade_name',
                'establishment_code',
                'establishment_address',
                'establishment_ubigeo',
                'establishment_urbanization',
                'establishment_department',
                'establishment_province',
                'establishment_district',
            ]);
            $table->unique(
                ['document_type', 'series_code', 'number'],
                'fiscal_documents_document_type_series_code_number_unique',
            );
        });
    }
};
