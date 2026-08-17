<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('historical_sale_import_rows', function (Blueprint $table): void {
            $table->string('transaction_type', 40)->nullable()->after('row_number');
            $table->string('origin')->nullable()->after('transaction_type');
            $table->string('destination')->nullable()->after('origin');
            $table->text('message')->nullable()->after('destination');
        });
    }

    public function down(): void
    {
        Schema::table('historical_sale_import_rows', function (Blueprint $table): void {
            $table->dropColumn(['transaction_type', 'origin', 'destination', 'message']);
        });
    }
};
