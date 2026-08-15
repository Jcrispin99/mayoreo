<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\DocumentSeriesFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $fiscal_issuer_id
 * @property string $document_type
 * @property string $purpose
 * @property string $series_code
 * @property int $current_number
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class DocumentSeries extends Model
{
    /** @use HasFactory<DocumentSeriesFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'fiscal_issuer_id',
        'document_type',
        'purpose',
        'series_code',
        'current_number',
        'is_active',
    ];

    /** @return BelongsToMany<CashRegister, $this> */
    public function cashRegisters(): BelongsToMany
    {
        return $this->belongsToMany(CashRegister::class, 'cash_register_document_series')->withTimestamps();
    }

    /**
     * @return BelongsTo<FiscalIssuer, $this>
     */
    public function fiscalIssuer(): BelongsTo
    {
        return $this->belongsTo(FiscalIssuer::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'current_number' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
