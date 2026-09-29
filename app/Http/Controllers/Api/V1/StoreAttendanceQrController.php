<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\RotateStoreAttendanceQrAction;
use App\Http\Controllers\Api\ApiController;
use App\Models\Store;
use App\Services\AttendanceQrPayloadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StoreAttendanceQrController extends ApiController
{
    public function show(Store $store, AttendanceQrPayloadService $payloadService): JsonResponse
    {
        $token = $store->attendanceQrToken;
        $permanentPayload = $token?->encrypted_token === null ? null : $payloadService->issue($token);

        return $this->success([
            'store_id' => $store->id,
            'configured' => $token !== null,
            'recoverable' => $permanentPayload !== null,
            'payload' => $permanentPayload['payload'] ?? null,
            'expires_at' => null,
            'rotated_at' => $token?->rotated_at?->toIso8601String(),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function rotate(Request $request, Store $store, RotateStoreAttendanceQrAction $action): JsonResponse
    {
        return $this->success($action->execute($store, $request->user()?->id), 'Código QR renovado')
            ->header('Cache-Control', 'no-store, private');
    }
}
