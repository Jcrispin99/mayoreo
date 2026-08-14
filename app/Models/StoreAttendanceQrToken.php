<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $store_id
 * @property string $token_hash
 * @property string|null $encrypted_token
 * @property int|null $rotated_by
 * @property Carbon $rotated_at
 * @property-read Store $store
 */
final class StoreAttendanceQrToken extends Model
{
    protected $fillable = ['store_id', 'token_hash', 'encrypted_token', 'rotated_by', 'rotated_at'];

    protected $hidden = ['token_hash', 'encrypted_token'];

    /** @return BelongsTo<Store, $this> */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    protected function casts(): array
    {
        return ['encrypted_token' => 'encrypted', 'rotated_at' => 'datetime'];
    }
}
