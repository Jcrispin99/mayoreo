<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_credentials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fiscal_issuer_id')
                ->unique()
                ->constrained('fiscal_issuers')
                ->restrictOnDelete();
            $table->string('environment', 20)->default('beta');
            $table->text('sol_username')->nullable();
            $table->text('sol_password')->nullable();
            $table->string('certificate_disk', 50)->nullable();
            $table->string('certificate_path')->nullable();
            $table->string('certificate_original_name')->nullable();
            $table->string('certificate_source_format', 20)->nullable();
            $table->char('certificate_fingerprint_sha256', 64)->nullable();
            $table->boolean('certificate_matches_ruc')->nullable();
            $table->boolean('certificate_is_self_signed')->nullable();
            $table->string('certificate_key_algorithm', 20)->nullable();
            $table->unsignedSmallInteger('certificate_key_size')->nullable();
            $table->string('certificate_serial_number', 150)->nullable();
            $table->text('certificate_subject')->nullable();
            $table->text('certificate_issuer')->nullable();
            $table->unsignedBigInteger('certificate_size_bytes')->nullable();
            $table->timestamp('certificate_valid_from')->nullable();
            $table->timestamp('certificate_expires_at')->nullable()->index();
            $table->timestamp('certificate_uploaded_at')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('certificate_uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_credentials');
    }
};
