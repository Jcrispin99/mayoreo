<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\FiscalCredential;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FiscalCredential
 */
final class FiscalCredentialResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hasCertificate = $this->hasCertificate();

        return [
            'environment' => $this->environment->value,
            'has_sol_username' => filled($this->sol_username),
            'has_sol_password' => filled($this->sol_password),
            'has_sol_credentials' => $this->hasSolCredentials(),
            'has_certificate' => $hasCertificate,
            'certificate' => $hasCertificate ? [
                'original_name' => $this->certificate_original_name,
                'source_format' => $this->certificate_source_format,
                'fingerprint_sha256' => $this->certificate_fingerprint_sha256,
                'matches_ruc' => $this->certificate_matches_ruc,
                'is_self_signed' => $this->certificate_is_self_signed,
                'key_algorithm' => $this->certificate_key_algorithm,
                'key_size' => $this->certificate_key_size,
                'serial_number' => $this->certificate_serial_number,
                'subject' => $this->certificate_subject,
                'issuer' => $this->certificate_issuer,
                'size_bytes' => $this->certificate_size_bytes,
                'valid_from' => $this->certificate_valid_from?->toIso8601String(),
                'expires_at' => $this->certificate_expires_at?->toIso8601String(),
                'uploaded_at' => $this->certificate_uploaded_at?->toIso8601String(),
                'is_expired' => $this->certificate_expires_at?->isPast() ?? false,
            ] : null,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
