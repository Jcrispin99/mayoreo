<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use Illuminate\Support\Facades\DB;

final readonly class CreatePosOrderAction
{
    public function execute(CashRegisterSession $session, ?int $createdBy): PosOrder
    {
        return DB::transaction(function () use ($session, $createdBy): PosOrder {
            $lockedSession = CashRegisterSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($lockedSession->status !== 'open') {
                throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
            }

            $latestNumber = $lockedSession->orders()->max('number');
            $nextNumber = is_numeric($latestNumber) ? ((int) $latestNumber) + 1 : 1;

            return $lockedSession->orders()->create([
                'number' => $nextNumber,
                'status' => 'open',
                'subtotal' => '0',
                'total' => '0',
                'created_by' => $createdBy,
            ]);
        });
    }
}
