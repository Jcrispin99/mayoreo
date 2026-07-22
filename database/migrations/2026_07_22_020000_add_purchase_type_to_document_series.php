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
        Schema::table('document_series', function (Blueprint $table): void {
            $table->string('document_type', 30)->change();
        });

        DB::table('document_series')->updateOrInsert(
            ['document_type' => 'purchase', 'series_code' => 'OC01'],
            ['current_number' => 0, 'is_active' => true, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    public function down(): void
    {
        DB::table('document_series')
            ->where('document_type', 'purchase')
            ->delete();

        Schema::table('document_series', function (Blueprint $table): void {
            $table->enum('document_type', ['sales_ticket', 'receipt', 'invoice'])->change();
        });
    }
};
