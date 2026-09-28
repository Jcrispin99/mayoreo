<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table): void {
            $table->string('document_type', 30)->change();
            $table->foreignId('affected_document_id')
                ->nullable()
                ->after('exchanged_from_document_id')
                ->constrained('fiscal_documents')
                ->nullOnDelete();
            $table->string('reason_code', 2)->nullable()->after('affected_document_id');
            $table->string('reason_description', 255)->nullable()->after('reason_code');
            $table->json('credit_note_items')->nullable()->after('reason_description');
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table): void {
            $table->dropColumn(['reason_code', 'reason_description', 'credit_note_items']);
            $table->dropConstrainedForeignId('affected_document_id');
            $table->enum('document_type', ['sales_ticket', 'receipt', 'invoice'])->change();
        });
    }
};
