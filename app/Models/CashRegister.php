<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $store_id
 * @property int $warehouse_id
 * @property int|null $default_sales_series_id
 * @property string $code
 * @property string $name
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class CashRegister extends Model
{
    protected $fillable = [
        'store_id',
        'warehouse_id',
        'default_sales_series_id',
        'code',
        'name',
        'is_active',
    ];

    /** @return BelongsTo<Store, $this> */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return BelongsToMany<DocumentSeries, $this> */
    public function salesSeries(): BelongsToMany
    {
        return $this->belongsToMany(DocumentSeries::class, 'cash_register_document_series')->withTimestamps();
    }

    /** @return BelongsTo<DocumentSeries, $this> */
    public function defaultSalesSeries(): BelongsTo
    {
        return $this->belongsTo(DocumentSeries::class, 'default_sales_series_id');
    }

    /** @return HasMany<CashRegisterSession, $this> */
    public function sessions(): HasMany
    {
        return $this->hasMany(CashRegisterSession::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
