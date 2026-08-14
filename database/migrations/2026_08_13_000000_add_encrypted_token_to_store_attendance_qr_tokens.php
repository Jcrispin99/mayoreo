<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_attendance_qr_tokens', function (Blueprint $table): void {
            $table->text('encrypted_token')->nullable()->after('token_hash');
        });

        $demoToken = 'demo-personal-principal';
        DB::table('store_attendance_qr_tokens')
            ->where('token_hash', hash('sha256', $demoToken))
            ->whereNull('encrypted_token')
            ->update(['encrypted_token' => Crypt::encryptString($demoToken)]);
    }

    public function down(): void
    {
        Schema::table('store_attendance_qr_tokens', function (Blueprint $table): void {
            $table->dropColumn('encrypted_token');
        });
    }
};
