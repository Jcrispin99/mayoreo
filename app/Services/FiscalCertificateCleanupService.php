<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use LogicException;
use RuntimeException;
use Throwable;

final class FiscalCertificateCleanupService
{
    /**
     * Register the future path before writing its blob. A delayed cleanup makes
     * an interrupted upload recoverable without racing a request still in flight.
     */
    public function stage(
        string $diskName,
        string $path,
        int $fiscalIssuerId,
    ): void {
        $graceMinutes = config('fiscal.certificate_staging_grace_minutes', 60);

        $this->enqueue(
            $diskName,
            $path,
            $fiscalIssuerId,
            'staged_upload',
            now()->addMinutes(is_numeric($graceMinutes) ? max(1, (int) $graceMinutes) : 60),
        );
    }

    /**
     * Queue a blob before its database reference is removed.
     *
     * This method deliberately lets database errors bubble up so a surrounding
     * transaction cannot publish a new pointer without a durable cleanup task.
     */
    public function enqueue(
        string $diskName,
        string $path,
        ?int $fiscalIssuerId,
        string $reason,
        ?Carbon $availableAt = null,
    ): void {
        $now = now();
        $query = DB::table('fiscal_certificate_cleanup_tasks')
            ->where('disk', $diskName)
            ->where('path', $path);

        DB::table('fiscal_certificate_cleanup_tasks')->insertOrIgnore([
            'fiscal_issuer_id' => $fiscalIssuerId,
            'disk' => $diskName,
            'path' => $path,
            'reason' => $reason,
            'last_error' => null,
            'attempts' => 0,
            'available_at' => $availableAt ?? $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $query->update([
            'fiscal_issuer_id' => $fiscalIssuerId,
            'reason' => $reason,
            'last_error' => null,
            'available_at' => $availableAt ?? $now,
            'updated_at' => $now,
        ]);
    }

    /**
     * Lock the staging record while a transaction publishes its blob pointer.
     */
    public function lockStaged(string $diskName, string $path): void
    {
        $task = DB::table('fiscal_certificate_cleanup_tasks')
            ->where('disk', $diskName)
            ->where('path', $path)
            ->where('reason', 'staged_upload')
            ->lockForUpdate()
            ->first();

        throw_if(
            $task === null,
            LogicException::class,
            'La carga temporal del certificado fiscal ya no está disponible.',
        );
    }

    /**
     * Remove a staging task in the same transaction that publishes its pointer.
     */
    public function cancel(string $diskName, string $path): void
    {
        $deleted = DB::table('fiscal_certificate_cleanup_tasks')
            ->where('disk', $diskName)
            ->where('path', $path)
            ->delete();

        throw_unless(
            $deleted === 1,
            LogicException::class,
            'No se pudo confirmar la publicación del certificado fiscal.',
        );
    }

    /**
     * Best-effort immediate processing for a task that is already durable.
     */
    public function processNow(string $diskName, string $path): bool
    {
        try {
            return $this->process($diskName, $path);
        } catch (Throwable $throwable) {
            report($throwable);

            return false;
        }
    }

    /**
     * @return array{processed: int, deleted: int, pending: int}
     */
    public function retryPending(int $limit = 100): array
    {
        $taskIds = DB::table('fiscal_certificate_cleanup_tasks')
            ->where('available_at', '<=', now())
            ->orderBy('id')
            ->limit(max(1, $limit))
            ->pluck('id');
        $deleted = 0;

        foreach ($taskIds as $taskId) {
            if (is_numeric($taskId) && $this->processById((int) $taskId)) {
                $deleted++;
            }
        }

        return [
            'processed' => $taskIds->count(),
            'deleted' => $deleted,
            'pending' => DB::table('fiscal_certificate_cleanup_tasks')->count(),
        ];
    }

    private function processById(int $taskId): bool
    {
        try {
            return DB::transaction(function () use ($taskId): bool {
                /** @var object{available_at: mixed, disk: mixed, path: mixed}|null $task */
                $task = DB::table('fiscal_certificate_cleanup_tasks')
                    ->where('id', $taskId)
                    ->lockForUpdate()
                    ->first();

                if ($task === null || $this->availableAtIsFuture($task->available_at)) {
                    return false;
                }

                return $this->deleteLockedTask($taskId, $task->disk, $task->path);
            });
        } catch (Throwable $throwable) {
            report($throwable);

            return false;
        }
    }

    private function process(string $diskName, string $path): bool
    {
        return DB::transaction(function () use ($diskName, $path): bool {
            /** @var object{id: mixed}|null $task */
            $task = DB::table('fiscal_certificate_cleanup_tasks')
                ->where('disk', $diskName)
                ->where('path', $path)
                ->lockForUpdate()
                ->first();

            if ($task === null) {
                return true;
            }

            $taskId = $task->id;

            throw_unless(
                is_numeric($taskId),
                RuntimeException::class,
                'La tarea de limpieza fiscal no tiene un identificador válido.',
            );

            return $this->deleteLockedTask((int) $taskId, $diskName, $path);
        });
    }

    private function availableAtIsFuture(mixed $availableAt): bool
    {
        return is_string($availableAt) && Carbon::parse($availableAt)->isFuture();
    }

    private function deleteLockedTask(
        int $taskId,
        mixed $diskName,
        mixed $path,
    ): bool {
        throw_unless(
            is_string($diskName) && $diskName !== '' && is_string($path) && $path !== '',
            RuntimeException::class,
            'La tarea de limpieza fiscal contiene una ruta inválida.',
        );

        $isReferenced = DB::table('fiscal_credentials')
            ->where('certificate_disk', $diskName)
            ->where('certificate_path', $path)
            ->exists();

        if ($isReferenced) {
            $this->recordFailure(
                $taskId,
                'El certificado todavía está referenciado y no puede eliminarse.',
            );

            return false;
        }

        try {
            $disk = Storage::disk($diskName);
            $deleted = ! $disk->exists($path) || $disk->delete($path);
        } catch (Throwable $throwable) {
            report($throwable);
            $this->recordFailure($taskId, $throwable::class);

            return false;
        }

        if (! $deleted) {
            $this->recordFailure(
                $taskId,
                'El almacenamiento no confirmó la eliminación del archivo.',
            );

            return false;
        }

        DB::table('fiscal_certificate_cleanup_tasks')
            ->where('id', $taskId)
            ->delete();

        return true;
    }

    private function recordFailure(int $taskId, string $message): void
    {
        $retryMinutes = config('fiscal.certificate_cleanup_retry_minutes', 15);
        $attempts = DB::table('fiscal_certificate_cleanup_tasks')
            ->where('id', $taskId)
            ->value('attempts');

        DB::table('fiscal_certificate_cleanup_tasks')
            ->where('id', $taskId)
            ->update([
                'last_error' => $message,
                'attempts' => is_numeric($attempts)
                    ? min((int) $attempts + 1, 65535)
                    : 1,
                'available_at' => now()->addMinutes(
                    is_numeric($retryMinutes) ? max(1, (int) $retryMinutes) : 15,
                ),
                'updated_at' => now(),
            ]);
    }
}
