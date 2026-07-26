<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table): void {
            $table->string('sunat_status', 20)->default('pending')->after('status');
            $table->unsignedSmallInteger('sunat_attempts')->default(0)->after('sunat_status');
            $table->string('sunat_error_code', 50)->nullable()->after('sunat_attempts');
            $table->text('sunat_error_message')->nullable()->after('sunat_error_code');
            $table->string('cdr_code', 10)->nullable()->after('sunat_error_message');
            $table->text('cdr_description')->nullable()->after('cdr_code');
            $table->json('cdr_notes')->nullable()->after('cdr_description');
            $table->string('xml_path')->nullable()->after('cdr_notes');
            $table->char('xml_hash', 64)->nullable()->after('xml_path');
            $table->string('cdr_path')->nullable()->after('xml_hash');
            $table->timestamp('sunat_sent_at')->nullable()->after('cdr_path');
            $table->timestamp('sunat_responded_at')->nullable()->after('sunat_sent_at');

            $table->index('sunat_status');
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table): void {
            $table->dropIndex(['sunat_status']);
            $table->dropColumn([
                'sunat_status',
                'sunat_attempts',
                'sunat_error_code',
                'sunat_error_message',
                'cdr_code',
                'cdr_description',
                'cdr_notes',
                'xml_path',
                'xml_hash',
                'cdr_path',
                'sunat_sent_at',
                'sunat_responded_at',
            ]);
        });
    }
};
