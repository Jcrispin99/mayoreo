<?php

declare(strict_types=1);

namespace App\Actions\Attendance;

use App\Models\Store;
use App\Services\AttendanceQrPayloadService;
use Illuminate\Support\Str;

final readonly class RotateStoreAttendanceQrAction
{
    public function __construct(private AttendanceQrPayloadService $payloadService) {}

    /** @return array{payload: string, expires_at: string, rotated_at: string} */
    public function execute(Store $store, ?int $rotatedBy): array
    {
        $rawToken = Str::random(64);
        $rotatedAt = now();

        $qr = $store->attendanceQrToken()->updateOrCreate([], [
            'token_hash' => hash('sha256', $rawToken),
            'encrypted_token' => $rawToken,
            'rotated_by' => $rotatedBy,
            'rotated_at' => $rotatedAt,
        ]);

        return [
            ...$this->payloadService->issue($qr),
            'rotated_at' => $rotatedAt->toIso8601String(),
        ];
    }
}
