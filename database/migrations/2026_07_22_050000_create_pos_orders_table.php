<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cash_register_session_id')->constrained('cash_register_sessions')->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->enum('status', ['open', 'completed', 'cancelled'])->default('open');
            $table->decimal('subtotal', 12, 4)->default(0);
            $table->decimal('total', 12, 4)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['cash_register_session_id', 'number']);
            $table->index(['cash_register_session_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_orders');
    }
};
