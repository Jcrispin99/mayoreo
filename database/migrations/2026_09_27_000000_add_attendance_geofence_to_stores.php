<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table): void {
            $table->decimal('attendance_latitude', 10, 7)->nullable()->after('phone');
            $table->decimal('attendance_longitude', 10, 7)->nullable()->after('attendance_latitude');
            $table->unsignedSmallInteger('attendance_radius_meters')->default(100)->after('attendance_longitude');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table): void {
            $table->dropColumn([
                'attendance_latitude',
                'attendance_longitude',
                'attendance_radius_meters',
            ]);
        });
    }
};
