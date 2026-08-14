<?php

declare(strict_types=1);

namespace App\Actions\Attendance;

use App\Models\Store;
use Illuminate\Support\Str;

final readonly class RotateStoreAttendanceQrAction
{
    /** @return array{payload: string, rotated_at: string} */
    public function execute(Store $store, ?int $rotatedBy): array
    {
        $prefix = config('payroll.qr_prefix');
        assert(is_string($prefix));
        $rawToken = Str::random(64);
        $rotatedAt = now();

        $store->attendanceQrToken()->updateOrCreate([], [
            'token_hash' => hash('sha256', $rawToken),
            'encrypted_token' => $rawToken,
            'rotated_by' => $rotatedBy,
            'rotated_at' => $rotatedAt,
        ]);

        return [
            'payload' => $prefix.$rawToken,
            'rotated_at' => $rotatedAt->toIso8601String(),
        ];
    }
}
