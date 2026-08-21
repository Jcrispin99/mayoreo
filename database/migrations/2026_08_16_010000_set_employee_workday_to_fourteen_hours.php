<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('employee_profiles')->update(['expected_minutes_per_day' => 840]);

        Schema::table('employee_profiles', function ($table): void {
            $table->unsignedSmallInteger('expected_minutes_per_day')->default(840)->change();
        });
    }

    public function down(): void
    {
        Schema::table('employee_profiles', function ($table): void {
            $table->unsignedSmallInteger('expected_minutes_per_day')->default(480)->change();
        });
    }
};
