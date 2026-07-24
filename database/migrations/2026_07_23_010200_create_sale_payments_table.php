<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('cash_register_session_id')
                ->constrained('cash_register_sessions')
                ->restrictOnDelete();
            $table->string('method', 30);
            $table->decimal('amount', 14, 2);
            $table->decimal('received_amount', 14, 2)->nullable();
            $table->decimal('change_amount', 14, 2)->default(0);
            $table->string('reference')->nullable();
            $table->string('status', 30)->default('completed');
            $table->timestamp('paid_at');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('sale_id');
            $table->index(
                ['cash_register_session_id', 'status', 'method'],
                'sale_payments_session_status_method_index',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
    }
};
