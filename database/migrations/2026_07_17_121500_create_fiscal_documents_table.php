<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('fiscal_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->enum('document_type', ['sales_ticket', 'receipt', 'invoice']);
            $table->string('series_code');
            $table->unsignedBigInteger('number');
            $table->enum('status', ['issued', 'exchanged', 'voided'])->default('issued');
            $table->foreignId('exchanged_from_document_id')->nullable()->constrained('fiscal_documents')->nullOnDelete();
            $table->timestamp('issued_at');
            $table->timestamps();

            $table->unique(['document_type', 'series_code', 'number']);
            $table->index('sale_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fiscal_documents');
    }
};
