<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\PosSupplyRequestException;
use App\Exceptions\StalePosSupplyRequestException;
use App\Models\PosSupplyRequest;
use App\Models\PosSupplyRequestItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class ManagePosSupplyPreparationAction
{
    public function acknowledge(PosSupplyRequest $request, User $user, int $expectedVersion): PosSupplyRequest
    {
        return DB::transaction(function () use ($request, $user, $expectedVersion): PosSupplyRequest {
            $locked = $this->lockAssigned($request, $user, $expectedVersion);

            if (! in_array($locked->status, ['assigned', 'preparing', 'changes_pending'], true)) {
                throw PosSupplyRequestException::invalidStatus($locked->status);
            }

            $locked->update([
                'status' => 'preparing',
                'acknowledged_version' => $locked->version,
                'acknowledged_at' => now(),
            ]);

            return $this->fresh($locked);
        });
    }

    /** @param numeric-string $preparedQuantity */
    public function updateItem(
        PosSupplyRequest $request,
        PosSupplyRequestItem $item,
        User $user,
        int $expectedVersion,
        string $preparedQuantity,
    ): PosSupplyRequest {
        return DB::transaction(function () use ($request, $item, $user, $expectedVersion, $preparedQuantity): PosSupplyRequest {
            $locked = $this->lockAssigned($request, $user, $expectedVersion);
            if ($locked->status !== 'preparing') {
                throw PosSupplyRequestException::invalidStatus($locked->status);
            }
            if ($locked->acknowledged_version !== $locked->version) {
                throw PosSupplyRequestException::reviewRequired();
            }

            $lockedItem = $locked->items()->lockForUpdate()->find($item->id);
            if (! $lockedItem instanceof PosSupplyRequestItem) {
                throw PosSupplyRequestException::itemDoesNotBelong();
            }

            $lockedItem->update([
                'prepared_quantity' => $preparedQuantity,
                'prepared_by' => $user->id,
                'prepared_at' => now(),
            ]);

            return $this->fresh($locked);
        });
    }

    public function markReady(PosSupplyRequest $request, User $user, int $expectedVersion): PosSupplyRequest
    {
        return DB::transaction(function () use ($request, $user, $expectedVersion): PosSupplyRequest {
            $locked = $this->lockAssigned($request, $user, $expectedVersion);
            if ($locked->status !== 'preparing') {
                throw PosSupplyRequestException::invalidStatus($locked->status);
            }
            if ($locked->acknowledged_version !== $locked->version) {
                throw PosSupplyRequestException::reviewRequired();
            }

            $items = $locked->items()->lockForUpdate()->get();
            $hasRequestedItems = false;
            foreach ($items as $item) {
                /** @var numeric-string $requested */
                $requested = (string) $item->requested_quantity;
                /** @var numeric-string $prepared */
                $prepared = (string) $item->prepared_quantity;
                $hasRequestedItems = $hasRequestedItems || bccomp($requested, '0', 6) > 0;

                if (bccomp($requested, $prepared, 6) !== 0) {
                    throw PosSupplyRequestException::incomplete();
                }
            }

            if (! $hasRequestedItems) {
                throw PosSupplyRequestException::incomplete();
            }

            $locked->update(['status' => 'ready', 'ready_at' => now()]);

            return $this->fresh($locked);
        });
    }

    private function lockAssigned(PosSupplyRequest $request, User $user, int $expectedVersion): PosSupplyRequest
    {
        $locked = PosSupplyRequest::query()->lockForUpdate()->findOrFail($request->id);
        if ($locked->assigned_to !== $user->id || ! $user->hasRole('warehouse')) {
            throw PosSupplyRequestException::notAssigned();
        }
        if ($locked->version !== $expectedVersion) {
            throw new StalePosSupplyRequestException;
        }

        return $locked;
    }

    private function fresh(PosSupplyRequest $request): PosSupplyRequest
    {
        return $request->fresh([
            'items.product.baseUnit',
            'posOrder',
            'fromWarehouse.store',
            'toWarehouse.store',
            'assignee',
        ]) ?? $request;
    }
}
