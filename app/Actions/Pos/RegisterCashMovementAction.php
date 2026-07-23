<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Models\CashRegisterMovement;
use App\Models\CashRegisterSession;
use Illuminate\Support\Facades\DB;

final readonly class RegisterCashMovementAction
{
    /**
     * @param  'income'|'expense'  $type
     * @param  numeric-string  $amount
     */
    public function execute(
        CashRegisterSession $session,
        string $type,
        string $amount,
        string $reason,
        ?string $notes,
        ?int $createdBy,
    ): CashRegisterMovement {
        return DB::transaction(function () use ($session, $type, $amount, $reason, $notes, $createdBy): CashRegisterMovement {
            $lockedSession = CashRegisterSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($lockedSession->status !== 'open') {
                throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
            }

            return $lockedSession->movements()->create([
                'type' => $type,
                'amount' => $amount,
                'reason' => $reason,
                'notes' => $notes,
                'created_by' => $createdBy,
                'occurred_at' => now(),
            ]);
        });
    }
}
