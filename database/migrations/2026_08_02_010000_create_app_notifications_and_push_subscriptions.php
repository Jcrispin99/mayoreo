<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::create('push_subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('expo_push_token', 255)->unique();
            $table->string('device_id', 128)->nullable();
            $table->string('platform', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_seen_at');
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->timestamp('price_changed_at')->nullable()->after('is_principal');
            $table->timestamp('price_highlight_until')->nullable()->after('price_changed_at');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['price_changed_at', 'price_highlight_until']);
        });

        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('notifications');
    }
};
