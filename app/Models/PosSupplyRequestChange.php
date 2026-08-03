<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PosSupplyRequestChange extends Model
{
    protected $fillable = ['version', 'actor_id', 'type', 'changes'];

    /** @return BelongsTo<PosSupplyRequest, $this> */
    public function supplyRequest(): BelongsTo
    {
        return $this->belongsTo(PosSupplyRequest::class, 'pos_supply_request_id');
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['changes' => 'array'];
    }
}
