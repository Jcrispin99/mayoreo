<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_series', function (Blueprint $table): void {
            $table->string('purpose')->default('operational')->after('document_type')->index();
        });

        Schema::create('historical_sale_imports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignId('document_series_id')->constrained('document_series')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_filename');
            $table->string('file_path');
            $table->string('file_hash', 64);
            $table->string('status')->default('draft')->index();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('ready_rows')->default(0);
            $table->unsignedInteger('imported_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->decimal('expected_total', 16, 2)->default(0);
            $table->decimal('imported_total', 16, 2)->default(0);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->unique(['warehouse_id', 'file_hash']);
        });

        Schema::create('historical_sale_import_rows', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('historical_sale_import_id')
                ->constrained('historical_sale_imports')
                ->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->timestamp('sold_at')->nullable()->index();
            $table->decimal('expected_total', 14, 2)->nullable();
            $table->string('status')->default('pending')->index();
            $table->json('proposed_items')->nullable();
            $table->text('error_message')->nullable();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->timestamps();

            $table->unique(['historical_sale_import_id', 'row_number'], 'historical_import_row_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('historical_sale_import_rows');
        Schema::dropIfExists('historical_sale_imports');

        Schema::table('document_series', function (Blueprint $table): void {
            $table->dropColumn('purpose');
        });
    }
};
