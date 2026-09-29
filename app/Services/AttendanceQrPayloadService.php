<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\PayrollException;
use App\Models\StoreAttendanceQrToken;

final class AttendanceQrPayloadService
{
    /** @return array{payload: string} */
    public function issue(StoreAttendanceQrToken $qr): array
    {
        $prefix = config('payroll.qr_prefix');
        assert(is_string($prefix));

        $secret = $qr->encrypted_token;
        if (! is_string($secret) || $secret === '') {
            throw PayrollException::invalidQr();
        }

        $signedValue = 'v3:'.$qr->store_id;
        $signature = hash_hmac('sha256', $signedValue, $secret);

        return [
            'payload' => $prefix.$signedValue.':'.$signature,
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
        if (preg_match('/^v3:([1-9]\d*):([a-f0-9]{64})$/', $encoded, $matches) === 1) {
            return $this->resolvePermanent((int) $matches[1], $matches[2]);
        }

        return $this->resolveLegacyDynamic($encoded, $ttlSeconds, $clockSkewSeconds);
    }

    private function resolvePermanent(int $storeId, string $signature): StoreAttendanceQrToken
    {
        $qr = $this->activeStoreQr($storeId);
        $secret = $qr->encrypted_token;
        assert(is_string($secret));

        $expected = hash_hmac('sha256', 'v3:'.$storeId, $secret);
        if (! hash_equals($expected, $signature)) {
            throw PayrollException::invalidQr();
        }

        return $qr;
    }

    private function resolveLegacyDynamic(
        string $encoded,
        int $ttlSeconds,
        int $clockSkewSeconds,
    ): StoreAttendanceQrToken {
        if (preg_match('/^v2:([1-9]\d*):(\d{10}):(\d{10}):([a-f0-9]{64})$/', $encoded, $matches) !== 1) {
            throw PayrollException::invalidQr();
        }

        $storeId = (int) $matches[1];
        $issuedAt = (int) $matches[2];
        $expiresAt = (int) $matches[3];
        $signature = $matches[4];
        $now = (int) now()->timestamp;

        if ($expiresAt <= $issuedAt || ($expiresAt - $issuedAt) > $ttlSeconds
            || $issuedAt > ($now + $clockSkewSeconds)) {
            throw PayrollException::invalidQr();
        }
        if ($expiresAt < ($now - $clockSkewSeconds)) {
            throw PayrollException::expiredQr();
        }

        $qr = $this->activeStoreQr($storeId);
        $secret = $qr->encrypted_token;
        assert(is_string($secret));

        $expected = hash_hmac('sha256', $this->signedValue($storeId, $issuedAt, $expiresAt), $secret);
        if (! hash_equals($expected, $signature)) {
            throw PayrollException::invalidQr();
        }

        return $qr;
    }

    private function activeStoreQr(int $storeId): StoreAttendanceQrToken
    {
        $qr = StoreAttendanceQrToken::query()->with('store')->where('store_id', $storeId)->first();
        $secret = $qr?->encrypted_token;
        if (! $qr || ! is_string($secret) || $secret === '' || ! $qr->store->is_active) {
            throw PayrollException::invalidQr();
        }

        return $qr;
    }

    private function signedValue(int $storeId, int $issuedAt, int $expiresAt): string
    {
        return $storeId.':'.$issuedAt.':'.$expiresAt;
    }
}
