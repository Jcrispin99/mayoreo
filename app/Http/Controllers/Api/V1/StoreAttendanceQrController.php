<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\RotateStoreAttendanceQrAction;
use App\Http\Controllers\Api\ApiController;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StoreAttendanceQrController extends ApiController
{
    public function show(Store $store): JsonResponse
    {
        $token = $store->attendanceQrToken;
        $prefix = config('payroll.qr_prefix');
        assert(is_string($prefix));
        $payload = $token?->encrypted_token === null ? null : $prefix.$token->encrypted_token;

        return $this->success([
            'store_id' => $store->id,
            'configured' => $token !== null,
            'recoverable' => $payload !== null,
            'payload' => $payload,
            'rotated_at' => $token?->rotated_at?->toIso8601String(),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function rotate(Request $request, Store $store, RotateStoreAttendanceQrAction $action): JsonResponse
    {
        return $this->success($action->execute($store, $request->user()?->id), 'Código QR renovado')
            ->header('Cache-Control', 'no-store, private');
    }
}
