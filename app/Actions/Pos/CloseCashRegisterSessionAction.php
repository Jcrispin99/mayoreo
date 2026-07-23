<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Models\CashRegisterSession;
use Illuminate\Support\Facades\DB;

final readonly class CloseCashRegisterSessionAction
{
    /** @param numeric-string $countedAmount */
    public function execute(CashRegisterSession $session, string $countedAmount, ?string $notes, ?int $closedBy): CashRegisterSession
    {
        return DB::transaction(function () use ($session, $countedAmount, $notes, $closedBy): CashRegisterSession {
            $lockedSession = CashRegisterSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($lockedSession->status !== 'open') {
                throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
            }

            if ($lockedSession->orders()->where('status', 'open')->exists()) {
                throw CashRegisterSessionException::hasOpenOrders($lockedSession->id);
            }

            $lockedSession->load('movements');
            $expectedAmount = $lockedSession->liveExpectedAmount();

            $lockedSession->update([
                'status' => 'closed',
                'expected_amount' => $expectedAmount,
                'counted_amount' => $countedAmount,
                'difference_amount' => bcsub($countedAmount, $expectedAmount, 2),
                'closing_notes' => $notes,
                'closed_by' => $closedBy,
                'closed_at' => now(),
            ]);

            return $lockedSession;
        });
    }
}
