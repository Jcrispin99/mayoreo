<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use Illuminate\Support\Facades\DB;

final readonly class OpenCashRegisterSessionAction
{
    /** @param numeric-string $openingAmount */
    public function execute(CashRegister $cashRegister, string $openingAmount, ?string $notes, ?int $openedBy): CashRegisterSession
    {
        return DB::transaction(function () use ($cashRegister, $openingAmount, $notes, $openedBy): CashRegisterSession {
            $lockedRegister = CashRegister::query()->lockForUpdate()->findOrFail($cashRegister->id);

            if (! $lockedRegister->is_active) {
                throw CashRegisterSessionException::inactiveRegister();
            }

            if ($lockedRegister->sessions()->where('status', 'open')->exists()) {
                throw CashRegisterSessionException::alreadyOpen($lockedRegister->id);
            }

            return $lockedRegister->sessions()->create([
                'opened_by' => $openedBy,
                'status' => 'open',
                'opening_amount' => $openingAmount,
                'opening_notes' => $notes,
                'opened_at' => now(),
            ]);
        });
    }
}
