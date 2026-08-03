<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_supply_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pos_order_id')->constrained('pos_orders')->cascadeOnDelete();
            $table->foreignId('from_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('to_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('inventory_transfer_id')->nullable()->constrained('inventory_transfers')->nullOnDelete();
            $table->string('status', 32)->default('assigned');
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('acknowledged_version')->default(0);
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['assigned_to', 'status']);
            $table->index(['pos_order_id', 'status']);
        });

        Schema::create('pos_supply_request_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pos_supply_request_id')->constrained('pos_supply_requests')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->decimal('requested_quantity', 18, 6);
            $table->decimal('prepared_quantity', 18, 6)->default(0);
            $table->string('change_type', 24)->nullable();
            $table->unsignedInteger('changed_version')->default(1);
            $table->foreignId('prepared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('prepared_at')->nullable();
            $table->timestamps();

            $table->unique(['pos_supply_request_id', 'product_id'], 'pos_supply_request_product_unique');
        });

        Schema::create('pos_supply_request_changes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pos_supply_request_id')->constrained('pos_supply_requests')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 40);
            $table->json('changes');
            $table->timestamps();

            $table->unique(['pos_supply_request_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_supply_request_changes');
        Schema::dropIfExists('pos_supply_request_items');
        Schema::dropIfExists('pos_supply_requests');
    }
};
