<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_certificate_cleanup_tasks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fiscal_issuer_id')
                ->nullable()
                ->constrained('fiscal_issuers')
                ->nullOnDelete();
            $table->string('disk', 50);
            $table->string('path');
            $table->string('reason', 30);
            $table->text('last_error')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('available_at')->index();
            $table->timestamps();

            $table->unique(['disk', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_certificate_cleanup_tasks');
    }
};
