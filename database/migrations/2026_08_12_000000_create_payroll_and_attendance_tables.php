<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('employment_status', 20)->default('active');
            $table->date('hired_at');
            $table->date('terminated_at')->nullable();
            $table->unsignedSmallInteger('expected_minutes_per_day')->default(840);
            $table->unsignedSmallInteger('monthly_divisor')->default(30);
            $table->json('work_days');
            $table->timestamps();
            $table->index(['employment_status', 'store_id']);
        });

        Schema::create('employee_compensations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_profile_id')->constrained()->cascadeOnDelete();
            $table->string('pay_type', 20);
            $table->decimal('amount', 12, 2);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
            $table->unique(['employee_profile_id', 'effective_from']);
            $table->index(['employee_profile_id', 'effective_from', 'effective_to'], 'employee_compensations_effective_index');
        });

        Schema::create('store_attendance_qr_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->foreignId('rotated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rotated_at');
            $table->timestamps();
        });

        Schema::create('attendance_shifts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_profile_id')->constrained()->restrictOnDelete();
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            $table->timestamp('clocked_in_at');
            $table->timestamp('clocked_out_at')->nullable();
            $table->unsignedInteger('worked_minutes')->nullable();
            $table->string('status', 20)->default('open');
            $table->string('source', 20)->default('qr');
            $table->timestamps();
            $table->index(['employee_profile_id', 'status']);
            $table->index(['store_id', 'clocked_in_at']);
        });

        Schema::create('attendance_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attendance_shift_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_profile_id')->constrained()->restrictOnDelete();
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            $table->string('type', 20);
            $table->timestamp('occurred_at');
            $table->string('source', 20);
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['employee_profile_id', 'occurred_at']);
        });

        Schema::create('attendance_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attendance_shift_id')->constrained()->cascadeOnDelete();
            $table->foreignId('adjusted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('previous_clocked_in_at');
            $table->timestamp('previous_clocked_out_at')->nullable();
            $table->timestamp('new_clocked_in_at');
            $table->timestamp('new_clocked_out_at')->nullable();
            $table->string('reason', 1000);
            $table->timestamps();
        });

        Schema::create('payroll_periods', function (Blueprint $table): void {
            $table->id();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 20)->default('open');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->unique(['starts_on', 'ends_on']);
        });

        Schema::create('payroll_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payroll_period_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_profile_id')->constrained()->restrictOnDelete();
            $table->string('pay_type', 20);
            $table->decimal('rate_amount', 12, 2);
            $table->unsignedSmallInteger('monthly_divisor')->nullable();
            $table->unsignedSmallInteger('scheduled_days')->default(0);
            $table->unsignedSmallInteger('valid_days')->default(0);
            $table->unsignedSmallInteger('absence_days')->default(0);
            $table->unsignedSmallInteger('incident_days')->default(0);
            $table->unsignedInteger('worked_minutes')->default(0);
            $table->decimal('calculated_amount', 12, 2);
            $table->decimal('adjustments_amount', 12, 2)->default(0);
            $table->decimal('payable_amount', 12, 2);
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
            $table->unique(['payroll_period_id', 'employee_profile_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_lines');
        Schema::dropIfExists('payroll_periods');
        Schema::dropIfExists('attendance_adjustments');
        Schema::dropIfExists('attendance_events');
        Schema::dropIfExists('attendance_shifts');
        Schema::dropIfExists('store_attendance_qr_tokens');
        Schema::dropIfExists('employee_compensations');
        Schema::dropIfExists('employee_profiles');
    }
};
