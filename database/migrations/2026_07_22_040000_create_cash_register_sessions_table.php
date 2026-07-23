<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_register_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cash_register_id')->constrained('cash_registers')->restrictOnDelete();
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->decimal('opening_amount', 14, 2);
            $table->decimal('expected_amount', 14, 2)->nullable();
            $table->decimal('counted_amount', 14, 2)->nullable();
            $table->decimal('difference_amount', 14, 2)->nullable();
            $table->text('opening_notes')->nullable();
            $table->text('closing_notes')->nullable();
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['cash_register_id', 'status']);
            $table->index(['opened_by', 'status']);
        });

        Schema::create('cash_register_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cash_register_session_id')->constrained('cash_register_sessions')->cascadeOnDelete();
            $table->enum('type', ['income', 'expense']);
            $table->decimal('amount', 14, 2);
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['cash_register_session_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_register_movements');
        Schema::dropIfExists('cash_register_sessions');
    }
};
