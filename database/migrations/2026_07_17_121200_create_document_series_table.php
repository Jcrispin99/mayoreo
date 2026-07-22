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
        Schema::create('document_series', function (Blueprint $table): void {
            $table->id();
            $table->enum('document_type', ['sales_ticket', 'receipt', 'invoice']);
            $table->string('series_code');
            $table->unsignedBigInteger('current_number')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['document_type', 'series_code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_series');
    }
};
