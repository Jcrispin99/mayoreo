<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $warehouse_id
 * @property int $document_series_id
 * @property int|null $created_by
 * @property string $original_filename
 * @property string $file_path
 * @property string $file_hash
 * @property string $status
 * @property int $total_rows
 * @property int $ready_rows
 * @property int $imported_rows
 * @property int $failed_rows
 * @property string $expected_total
 * @property string $imported_total
 * @property Carbon|null $confirmed_at
 */
final class HistoricalSaleImport extends Model
{
    protected $fillable = [
        'warehouse_id',
        'document_series_id',
        'created_by',
        'original_filename',
        'file_path',
        'file_hash',
        'status',
        'total_rows',
        'ready_rows',
        'imported_rows',
        'failed_rows',
        'expected_total',
        'imported_total',
        'confirmed_at',
    ];

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return BelongsTo<DocumentSeries, $this> */
    public function documentSeries(): BelongsTo
    {
        return $this->belongsTo(DocumentSeries::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<HistoricalSaleImportRow, $this> */
    public function rows(): HasMany
    {
        return $this->hasMany(HistoricalSaleImportRow::class);
    }

    public function refreshStatistics(): void
    {
        $expectedTotal = $this->rows()->sum('expected_total');
        $importedTotal = $this->rows()
            ->where('status', 'imported')
            ->sum('expected_total');

        $this->forceFill([
            'total_rows' => $this->rows()->count(),
            'ready_rows' => $this->rows()->where('status', 'ready')->count(),
            'imported_rows' => $this->rows()->where('status', 'imported')->count(),
            'failed_rows' => $this->rows()->whereIn('status', ['invalid', 'failed'])->count(),
            'expected_total' => (string) $expectedTotal,
            'imported_total' => (string) $importedTotal,
        ])->save();
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'ready_rows' => 'integer',
            'imported_rows' => 'integer',
            'failed_rows' => 'integer',
            'expected_total' => 'decimal:2',
            'imported_total' => 'decimal:2',
            'confirmed_at' => 'datetime',
        ];
    }
}
