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
 * @property string $document_type
 * @property string $series_code
 * @property int $number
 * @property string $status
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
        'document_type',
        'series_code',
        'number',
        'status',
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

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'issued_at' => 'datetime',
        ];
    }
}
