<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\SunatEnvironment;
use Database\Factories\FiscalCredentialFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fiscal_issuer_id
 * @property SunatEnvironment $environment
 * @property string|null $sol_username
 * @property string|null $sol_password
 * @property string|null $certificate_disk
 * @property string|null $certificate_path
 * @property string|null $certificate_original_name
 * @property string|null $certificate_source_format
 * @property string|null $certificate_fingerprint_sha256
 * @property bool|null $certificate_matches_ruc
 * @property bool|null $certificate_is_self_signed
 * @property string|null $certificate_key_algorithm
 * @property int|null $certificate_key_size
 * @property string|null $certificate_serial_number
 * @property string|null $certificate_subject
 * @property string|null $certificate_issuer
 * @property int|null $certificate_size_bytes
 * @property Carbon|null $certificate_valid_from
 * @property Carbon|null $certificate_expires_at
 * @property Carbon|null $certificate_uploaded_at
 * @property int|null $updated_by_user_id
 * @property int|null $certificate_uploaded_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class FiscalCredential extends Model
{
    /** @use HasFactory<FiscalCredentialFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'environment',
        'sol_username',
        'sol_password',
        'updated_by_user_id',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'sol_username',
        'sol_password',
        'certificate_disk',
        'certificate_path',
    ];

    /**
     * @return BelongsTo<FiscalIssuer, $this>
     */
    public function fiscalIssuer(): BelongsTo
    {
        return $this->belongsTo(FiscalIssuer::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function certificateUploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'certificate_uploaded_by_user_id');
    }

    public function hasSolCredentials(): bool
    {
        return filled($this->sol_username) && filled($this->sol_password);
    }

    public function hasCertificate(): bool
    {
        return filled($this->certificate_disk) && filled($this->certificate_path);
    }

    public function certificateIsCurrentlyValid(): bool
    {
        return $this->hasCertificate()
            && $this->certificate_valid_from?->isPast() === true
            && $this->certificate_expires_at?->isFuture() === true;
    }

    public function certificateMeetsProductionRequirements(): bool
    {
        return $this->certificateIsCurrentlyValid()
            && $this->certificate_matches_ruc === true
            && $this->certificate_is_self_signed === false;
    }

    public function configurationIsComplete(): bool
    {
        if (! $this->hasSolCredentials() || ! $this->certificateIsCurrentlyValid()) {
            return false;
        }

        return $this->environment === SunatEnvironment::Beta
            || $this->certificateMeetsProductionRequirements();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'environment' => SunatEnvironment::class,
            'sol_username' => 'encrypted',
            'sol_password' => 'encrypted',
            'certificate_matches_ruc' => 'boolean',
            'certificate_is_self_signed' => 'boolean',
            'certificate_key_size' => 'integer',
            'certificate_size_bytes' => 'integer',
            'certificate_valid_from' => 'datetime',
            'certificate_expires_at' => 'datetime',
            'certificate_uploaded_at' => 'datetime',
        ];
    }
}
