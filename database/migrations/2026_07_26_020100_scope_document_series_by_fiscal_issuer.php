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
        Schema::table('document_series', function (Blueprint $table): void {
            $table->dropUnique('document_series_document_type_series_code_unique');
            $table->foreignId('fiscal_issuer_id')
                ->nullable()
                ->after('id')
                ->constrained('fiscal_issuers')
                ->restrictOnDelete();
            $table->unsignedBigInteger('fiscal_scope_id')
                ->virtualAs('COALESCE(fiscal_issuer_id, 0)')
                ->after('fiscal_issuer_id');
            $table->unique(
                ['fiscal_scope_id', 'document_type', 'series_code'],
                'document_series_issuer_type_code_unique',
            );
        });

        $assignments = DB::table('cash_register_document_series')
            ->join('cash_registers', 'cash_registers.id', '=', 'cash_register_document_series.cash_register_id')
            ->join('stores', 'stores.id', '=', 'cash_registers.store_id')
            ->whereNotNull('stores.fiscal_issuer_id')
            ->select([
                'cash_register_document_series.document_series_id',
                'stores.fiscal_issuer_id',
            ])
            ->get();

        foreach ($assignments as $assignment) {
            DB::table('document_series')
                ->where('id', $assignment->document_series_id)
                ->whereNull('fiscal_issuer_id')
                ->update(['fiscal_issuer_id' => $assignment->fiscal_issuer_id]);
        }
    }

    public function down(): void
    {
        Schema::table('document_series', function (Blueprint $table): void {
            $table->dropUnique('document_series_issuer_type_code_unique');
            $table->dropColumn('fiscal_scope_id');
            $table->dropConstrainedForeignId('fiscal_issuer_id');
            $table->unique(
                ['document_type', 'series_code'],
                'document_series_document_type_series_code_unique',
            );
        });
    }
};
