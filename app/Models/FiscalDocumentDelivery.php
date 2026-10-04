<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fiscal_document_id
 * @property string $channel
 * @property string $destination
 * @property string $access_token
 * @property int|null $created_by
 * @property Carbon|null $opened_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class FiscalDocumentDelivery extends Model
{
    /** @var list<string> */
    protected $hidden = ['access_token'];

    /** @var list<string> */
    protected $fillable = [
        'fiscal_document_id',
        'channel',
        'destination',
        'access_token',
        'created_by',
        'opened_at',
    ];

    /** @return BelongsTo<FiscalDocument, $this> */
    public function fiscalDocument(): BelongsTo
    {
        return $this->belongsTo(FiscalDocument::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
        ];
    }
}
