<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\StoreFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $fiscal_issuer_id
 * @property string $code
 * @property string $name
 * @property string|null $address
 * @property string|null $phone
 * @property string|null $sunat_establishment_code
 * @property string|null $sunat_address
 * @property string|null $sunat_ubigeo
 * @property string|null $sunat_urbanization
 * @property string|null $sunat_department
 * @property string|null $sunat_province
 * @property string|null $sunat_district
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class Store extends Model
{
    /** @use HasFactory<StoreFactory> */
    use HasFactory;

    protected $fillable = [
        'fiscal_issuer_id',
        'code',
        'name',
        'address',
        'phone',
        'sunat_establishment_code',
        'sunat_address',
        'sunat_ubigeo',
        'sunat_urbanization',
        'sunat_department',
        'sunat_province',
        'sunat_district',
        'is_active',
    ];

    /**
     * @return BelongsTo<FiscalIssuer, $this>
     */
    public function fiscalIssuer(): BelongsTo
    {
        return $this->belongsTo(FiscalIssuer::class);
    }

    /**
     * @return HasMany<Warehouse, $this>
     */
    public function warehouses(): HasMany
    {
        return $this->hasMany(Warehouse::class);
    }

    /** @return HasMany<CashRegister, $this> */
    public function cashRegisters(): HasMany
    {
        return $this->hasMany(CashRegister::class);
    }

    /** @return HasMany<EmployeeProfile, $this> */
    public function employeeProfiles(): HasMany
    {
        return $this->hasMany(EmployeeProfile::class);
    }

    /** @return HasOne<StoreAttendanceQrToken, $this> */
    public function attendanceQrToken(): HasOne
    {
        return $this->hasOne(StoreAttendanceQrToken::class);
    }

    /**
     * @return HasMany<FiscalDocument, $this>
     */
    public function fiscalDocuments(): HasMany
    {
        return $this->hasMany(FiscalDocument::class);
    }

    public function hasCompleteSunatAddress(): bool
    {
        return filled($this->sunat_establishment_code)
            && filled($this->sunat_address)
            && filled($this->sunat_ubigeo)
            && filled($this->sunat_department)
            && filled($this->sunat_province)
            && filled($this->sunat_district);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
