<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\FiscalIssuerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $ruc
 * @property string $legal_name
 * @property string|null $trade_name
 * @property string|null $fiscal_address
 * @property string|null $ubigeo
 * @property string|null $urbanization
 * @property string|null $department
 * @property string|null $province
 * @property string|null $district
 * @property string|null $phone
 * @property string|null $email
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read FiscalCredential|null $credential
 */
final class FiscalIssuer extends Model
{
    /** @use HasFactory<FiscalIssuerFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'ruc',
        'legal_name',
        'trade_name',
        'fiscal_address',
        'ubigeo',
        'urbanization',
        'department',
        'province',
        'district',
        'phone',
        'email',
        'is_active',
    ];

    /**
     * @return HasOne<FiscalCredential, $this>
     */
    public function credential(): HasOne
    {
        return $this->hasOne(FiscalCredential::class);
    }

    /**
     * @return HasMany<Store, $this>
     */
    public function stores(): HasMany
    {
        return $this->hasMany(Store::class);
    }

    /**
     * @return HasMany<DocumentSeries, $this>
     */
    public function documentSeries(): HasMany
    {
        return $this->hasMany(DocumentSeries::class);
    }

    /**
     * @return HasMany<FiscalDocument, $this>
     */
    public function fiscalDocuments(): HasMany
    {
        return $this->hasMany(FiscalDocument::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
