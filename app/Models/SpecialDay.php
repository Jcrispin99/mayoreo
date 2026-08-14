<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property Carbon $date
 * @property string $name
 * @property int $bonus_percentage
 * @property bool $is_active
 * @property int|null $created_by
 */
final class SpecialDay extends Model
{
    protected $fillable = ['date', 'name', 'bonus_percentage', 'is_active', 'created_by'];

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected function casts(): array
    {
        return ['date' => 'date', 'bonus_percentage' => 'integer', 'is_active' => 'boolean'];
    }
}
