<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table): void {
            $table->foreignId('fiscal_issuer_id')
                ->nullable()
                ->after('id')
                ->constrained('fiscal_issuers')
                ->restrictOnDelete();
            $table->char('sunat_establishment_code', 4)->nullable()->after('phone');
            $table->unique(
                ['fiscal_issuer_id', 'sunat_establishment_code'],
                'stores_fiscal_issuer_establishment_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table): void {
            $table->dropUnique('stores_fiscal_issuer_establishment_unique');
            $table->dropConstrainedForeignId('fiscal_issuer_id');
            $table->dropColumn('sunat_establishment_code');
        });
    }
};
