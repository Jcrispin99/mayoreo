<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $historical_sale_import_id
 * @property int $row_number
 * @property Carbon|null $sold_at
 * @property string|null $expected_total
 * @property string $status
 * @property list<array<string, mixed>>|null $proposed_items
 * @property string|null $error_message
 * @property int|null $sale_id
 */
final class HistoricalSaleImportRow extends Model
{
    protected $fillable = [
        'historical_sale_import_id',
        'row_number',
        'sold_at',
        'expected_total',
        'status',
        'proposed_items',
        'error_message',
        'sale_id',
    ];

    /** @return BelongsTo<HistoricalSaleImport, $this> */
    public function import(): BelongsTo
    {
        return $this->belongsTo(HistoricalSaleImport::class, 'historical_sale_import_id');
    }

    /** @return BelongsTo<Sale, $this> */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'row_number' => 'integer',
            'sold_at' => 'datetime',
            'expected_total' => 'decimal:2',
            'proposed_items' => 'array',
        ];
    }
}
