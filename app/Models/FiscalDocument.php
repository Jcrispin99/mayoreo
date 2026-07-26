<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\FiscalDocumentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $sale_id
 * @property int|null $fiscal_issuer_id
 * @property int|null $store_id
 * @property string|null $issuer_ruc
 * @property string|null $issuer_legal_name
 * @property string|null $issuer_trade_name
 * @property string|null $establishment_code
 * @property string|null $establishment_address
 * @property string|null $establishment_ubigeo
 * @property string|null $establishment_urbanization
 * @property string|null $establishment_department
 * @property string|null $establishment_province
 * @property string|null $establishment_district
 * @property string $document_type
 * @property string $series_code
 * @property int $number
 * @property string $status
 * @property string $sunat_status
 * @property int $sunat_attempts
 * @property string|null $sunat_error_code
 * @property string|null $sunat_error_message
 * @property string|null $cdr_code
 * @property string|null $cdr_description
 * @property list<string>|null $cdr_notes
 * @property string|null $xml_path
 * @property string|null $xml_hash
 * @property string|null $cdr_path
 * @property Carbon|null $sunat_sent_at
 * @property Carbon|null $sunat_responded_at
 * @property int|null $exchanged_from_document_id
 * @property Carbon $issued_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class FiscalDocument extends Model
{
    /** @use HasFactory<FiscalDocumentFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'sale_id',
        'fiscal_issuer_id',
        'store_id',
        'issuer_ruc',
        'issuer_legal_name',
        'issuer_trade_name',
        'establishment_code',
        'establishment_address',
        'establishment_ubigeo',
        'establishment_urbanization',
        'establishment_department',
        'establishment_province',
        'establishment_district',
        'document_type',
        'series_code',
        'number',
        'status',
        'sunat_status',
        'sunat_attempts',
        'sunat_error_code',
        'sunat_error_message',
        'cdr_code',
        'cdr_description',
        'cdr_notes',
        'xml_path',
        'xml_hash',
        'cdr_path',
        'sunat_sent_at',
        'sunat_responded_at',
        'exchanged_from_document_id',
        'issued_at',
    ];

    /**
     * @return BelongsTo<Sale, $this>
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    /**
     * @return BelongsTo<FiscalIssuer, $this>
     */
    public function fiscalIssuer(): BelongsTo
    {
        return $this->belongsTo(FiscalIssuer::class);
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * @return BelongsTo<FiscalDocument, $this>
     */
    public function exchangedFrom(): BelongsTo
    {
        return $this->belongsTo(self::class, 'exchanged_from_document_id');
    }

    /**
     * @return HasOne<FiscalDocument, $this>
     */
    public function exchangedTo(): HasOne
    {
        return $this->hasOne(self::class, 'exchanged_from_document_id');
    }

    public function hasFiscalIdentitySnapshot(): bool
    {
        return $this->fiscal_issuer_id !== null
            && $this->store_id !== null
            && filled($this->issuer_ruc)
            && filled($this->issuer_legal_name)
            && filled($this->establishment_code)
            && filled($this->establishment_address)
            && filled($this->establishment_ubigeo)
            && filled($this->establishment_department)
            && filled($this->establishment_province)
            && filled($this->establishment_district);
    }

    /**
     * @return array{
     *     fiscal_issuer_id: int|null,
     *     store_id: int|null,
     *     issuer_ruc: string|null,
     *     issuer_legal_name: string|null,
     *     issuer_trade_name: string|null,
     *     establishment_code: string|null,
     *     establishment_address: string|null,
     *     establishment_ubigeo: string|null,
     *     establishment_urbanization: string|null,
     *     establishment_department: string|null,
     *     establishment_province: string|null,
     *     establishment_district: string|null
     * }
     */
    public function fiscalIdentitySnapshot(): array
    {
        return [
            'fiscal_issuer_id' => $this->fiscal_issuer_id,
            'store_id' => $this->store_id,
            'issuer_ruc' => $this->issuer_ruc,
            'issuer_legal_name' => $this->issuer_legal_name,
            'issuer_trade_name' => $this->issuer_trade_name,
            'establishment_code' => $this->establishment_code,
            'establishment_address' => $this->establishment_address,
            'establishment_ubigeo' => $this->establishment_ubigeo,
            'establishment_urbanization' => $this->establishment_urbanization,
            'establishment_department' => $this->establishment_department,
            'establishment_province' => $this->establishment_province,
            'establishment_district' => $this->establishment_district,
        ];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'sunat_attempts' => 'integer',
            'cdr_notes' => 'array',
            'issued_at' => 'datetime',
            'sunat_sent_at' => 'datetime',
            'sunat_responded_at' => 'datetime',
        ];
    }
}
