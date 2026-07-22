<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\UnitOfMeasureFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $type
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class UnitOfMeasure extends Model
{
    /** @use HasFactory<UnitOfMeasureFactory> */
    use HasFactory;

    protected $table = 'units_of_measure';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'type',
    ];

    /**
     * @return HasMany<Product, $this>
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'base_unit_id');
    }

    /**
     * @return HasMany<Productable, $this>
     */
    public function saleItems(): HasMany
    {
        return $this->hasMany(Productable::class, 'input_unit_id');
    }
}
