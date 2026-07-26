<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_issuers', function (Blueprint $table): void {
            $table->id();
            $table->char('ruc', 11)->unique();
            $table->string('legal_name');
            $table->string('trade_name')->nullable();
            $table->string('fiscal_address')->nullable();
            $table->char('ubigeo', 6)->nullable();
            $table->string('urbanization', 100)->nullable();
            $table->string('department', 100)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_issuers');
    }
};
