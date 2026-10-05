<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_compensations', function (Blueprint $table): void {
            $table->unsignedInteger('expected_minutes')->nullable()->after('amount');
        });

        Schema::table('payroll_periods', function (Blueprint $table): void {
            $table->dropUnique(['starts_on', 'ends_on']);
            $table->string('pay_frequency', 20)->default('monthly')->after('ends_on');
            $table->unique(['starts_on', 'ends_on', 'pay_frequency']);
        });

        Schema::table('payroll_lines', function (Blueprint $table): void {
            $table->unsignedInteger('required_minutes')->default(0)->after('worked_minutes');
            $table->unsignedInteger('credited_minutes')->default(0)->after('required_minutes');
            $table->decimal('completion_ratio', 8, 6)->default(0)->after('credited_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_lines', function (Blueprint $table): void {
            $table->dropColumn(['required_minutes', 'credited_minutes', 'completion_ratio']);
        });

        Schema::table('payroll_periods', function (Blueprint $table): void {
            $table->dropUnique(['starts_on', 'ends_on', 'pay_frequency']);
            $table->dropColumn('pay_frequency');
            $table->unique(['starts_on', 'ends_on']);
        });

        Schema::table('employee_compensations', function (Blueprint $table): void {
            $table->dropColumn('expected_minutes');
        });
    }
};
