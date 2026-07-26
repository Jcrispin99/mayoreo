<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\FiscalCertificateCleanupService;
use Illuminate\Console\Command;

final class CleanupFiscalCertificates extends Command
{
    protected $signature = 'fiscal-certificates:cleanup {--limit=100}';

    protected $description = 'Reintenta eliminar certificados fiscales cifrados pendientes de limpieza';

    public function handle(FiscalCertificateCleanupService $cleanupService): int
    {
        $limit = $this->option('limit');
        $result = $cleanupService->retryPending(is_numeric($limit) ? (int) $limit : 100);

        $this->info(sprintf(
            'Procesados: %d, eliminados: %d, pendientes: %d',
            $result['processed'],
            $result['deleted'],
            $result['pending'],
        ));

        return self::SUCCESS;
    }
}
