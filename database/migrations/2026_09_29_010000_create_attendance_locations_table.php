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
        Schema::create('attendance_locations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->unsignedSmallInteger('radius_meters')->default(100);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['store_id', 'is_active']);
        });

        $now = now();
        DB::table('stores')
            ->whereNotNull('attendance_latitude')
            ->whereNotNull('attendance_longitude')
            ->orderBy('id')
            ->each(function (object $store) use ($now): void {
                DB::table('attendance_locations')->insert([
                    'store_id' => $store->id,
                    'name' => 'Ubicación principal',
                    'latitude' => $store->attendance_latitude,
                    'longitude' => $store->attendance_longitude,
                    'radius_meters' => $store->attendance_radius_meters,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_locations');
    }
};
