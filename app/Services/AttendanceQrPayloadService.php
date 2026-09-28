<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\PayrollException;
use App\Models\StoreAttendanceQrToken;

final class AttendanceQrPayloadService
{
    /** @return array{payload: string, expires_at: string} */
    public function issue(StoreAttendanceQrToken $qr): array
    {
        $prefix = config('payroll.qr_prefix');
        $ttlSeconds = config('payroll.qr_ttl_seconds');
        assert(is_string($prefix));
        assert(is_int($ttlSeconds));

        $secret = $qr->encrypted_token;
        if (! is_string($secret) || $secret === '') {
            throw PayrollException::invalidQr();
        }

        $issuedAt = now()->timestamp;
        $expiresAt = $issuedAt + $ttlSeconds;
        $signedValue = $this->signedValue($qr->store_id, $issuedAt, $expiresAt);
        $signature = hash_hmac('sha256', $signedValue, $secret);

        return [
            'payload' => $prefix.'v2:'.$signedValue.':'.$signature,
            'expires_at' => now()->setTimestamp($expiresAt)->toIso8601String(),
        ];
    }

    public function resolve(string $payload): StoreAttendanceQrToken
    {
        $prefix = config('payroll.qr_prefix');
        $ttlSeconds = config('payroll.qr_ttl_seconds');
        $clockSkewSeconds = config('payroll.qr_clock_skew_seconds');
        assert(is_string($prefix));
        assert(is_int($ttlSeconds));
        assert(is_int($clockSkewSeconds));

        if (! str_starts_with($payload, $prefix)) {
            throw PayrollException::invalidQr();
        }

        $encoded = mb_substr($payload, mb_strlen($prefix));
        if (preg_match('/^v2:([1-9]\d*):(\d{10}):(\d{10}):([a-f0-9]{64})$/', $encoded, $matches) !== 1) {
            throw PayrollException::invalidQr();
        }

        $storeId = (int) $matches[1];
        $issuedAt = (int) $matches[2];
        $expiresAt = (int) $matches[3];
        $signature = $matches[4];
        $now = now()->timestamp;

        if ($expiresAt <= $issuedAt || ($expiresAt - $issuedAt) > $ttlSeconds
            || $issuedAt > ($now + $clockSkewSeconds)) {
            throw PayrollException::invalidQr();
        }
        if ($expiresAt < ($now - $clockSkewSeconds)) {
            throw PayrollException::expiredQr();
        }

        $qr = StoreAttendanceQrToken::query()->with('store')->where('store_id', $storeId)->first();
        $secret = $qr?->encrypted_token;
        if (! $qr || ! is_string($secret) || $secret === '' || ! $qr->store->is_active) {
            throw PayrollException::invalidQr();
        }

        $expected = hash_hmac('sha256', $this->signedValue($storeId, $issuedAt, $expiresAt), $secret);
        if (! hash_equals($expected, $signature)) {
            throw PayrollException::invalidQr();
        }

        return $qr;
    }

    private function signedValue(int $storeId, int $issuedAt, int $expiresAt): string
    {
        return $storeId.':'.$issuedAt.':'.$expiresAt;
    }
}
