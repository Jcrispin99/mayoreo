<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('special_days', function (Blueprint $table): void {
            $table->id();
            $table->date('date')->unique();
            $table->string('name', 150);
            $table->unsignedSmallInteger('bonus_percentage');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('payroll_lines', function (Blueprint $table): void {
            $table->decimal('base_amount', 12, 2)->default(0)->after('worked_minutes');
            $table->decimal('attendance_deduction', 12, 2)->default(0)->after('base_amount');
            $table->decimal('special_day_bonus', 12, 2)->default(0)->after('attendance_deduction');
            $table->decimal('worked_day_equivalents', 8, 4)->default(0)->after('special_day_bonus');
            $table->unsignedInteger('special_day_minutes')->default(0)->after('worked_day_equivalents');
            $table->json('special_day_details')->nullable()->after('special_day_minutes');
        });

        DB::table('payroll_lines')->update(['base_amount' => DB::raw('calculated_amount')]);
    }

    public function down(): void
    {
        Schema::table('payroll_lines', function (Blueprint $table): void {
            $table->dropColumn([
                'base_amount', 'attendance_deduction', 'special_day_bonus',
                'worked_day_equivalents', 'special_day_minutes', 'special_day_details',
            ]);
        });
        Schema::dropIfExists('special_days');
    }
};
