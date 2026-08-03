<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Models\PosOrder;
use App\Models\PosSupplyRequest;
use App\Models\PosSupplyRequestItem;

final readonly class SyncPosSupplyRequestAction
{
    public function execute(PosOrder $order, ?int $actorId): void
    {
        $request = $order->supplyRequests()
            ->whereIn('status', ['assigned', 'preparing', 'changes_pending', 'ready'])
            ->lockForUpdate()
            ->latest('id')
            ->first();

        if (! $request instanceof PosSupplyRequest) {
            return;
        }

        $delivered = $order->supplyRequests()
            ->where('status', 'delivered')
            ->with('items')
            ->get();
        /** @var array<int, numeric-string> $deliveredQuantities */
        $deliveredQuantities = [];
        foreach ($delivered as $deliveredRequest) {
            foreach ($deliveredRequest->items as $deliveredItem) {
                /** @var numeric-string $current */
                $current = $deliveredQuantities[$deliveredItem->product_id] ?? '0';
                /** @var numeric-string $quantity */
                $quantity = (string) $deliveredItem->requested_quantity;
                $deliveredQuantities[$deliveredItem->product_id] = bcadd($current, $quantity, 6);
            }
        }

        /** @var array<int, array{quantity: numeric-string, warehouse_notes: string|null}> $desired */
        $desired = [];
        foreach ($order->items()->get() as $orderItem) {
            /** @var numeric-string $orderQuantity */
            $orderQuantity = (string) $orderItem->quantity;
            /** @var numeric-string $alreadyDelivered */
            $alreadyDelivered = $deliveredQuantities[$orderItem->product_id] ?? '0';
            /** @var numeric-string $remaining */
            $remaining = bcsub($orderQuantity, $alreadyDelivered, 6);
            $desired[$orderItem->product_id] = [
                'quantity' => bccomp($remaining, '0', 6) > 0 ? $remaining : '0.000000',
                'warehouse_notes' => $orderItem->warehouse_notes,
            ];
        }

        $requestItems = $request->items()->lockForUpdate()->get()->keyBy('product_id');
        /** @var list<array{product_id: int, type: string, before: numeric-string, after: numeric-string, before_notes: string|null, after_notes: string|null}> $itemChanges */
        $itemChanges = [];

        foreach ($desired as $productId => $desiredItem) {
            $requestItem = $requestItems->get($productId);

            if (! $requestItem instanceof PosSupplyRequestItem) {
                if (bccomp($desiredItem['quantity'], '0', 6) <= 0) {
                    continue;
                }

                $itemChanges[] = [
                    'product_id' => $productId,
                    'type' => 'added',
                    'before' => '0.000000',
                    'after' => $desiredItem['quantity'],
                    'before_notes' => null,
                    'after_notes' => $desiredItem['warehouse_notes'],
                ];

                continue;
            }

            /** @var numeric-string $before */
            $before = (string) $requestItem->requested_quantity;
            $comparison = bccomp($desiredItem['quantity'], $before, 6);
            $notesChanged = $desiredItem['warehouse_notes'] !== $requestItem->warehouse_notes;
            if ($comparison === 0 && ! $notesChanged) {
                continue;
            }

            $itemChanges[] = [
                'product_id' => $productId,
                'type' => $comparison === 0
                    ? 'note_changed'
                    : ($desiredItem['quantity'] === '0.000000' ? 'removed' : ($comparison > 0 ? 'increased' : 'decreased')),
                'before' => $before,
                'after' => $desiredItem['quantity'],
                'before_notes' => $requestItem->warehouse_notes,
                'after_notes' => $desiredItem['warehouse_notes'],
            ];
        }

        foreach ($requestItems as $requestItem) {
            if (array_key_exists($requestItem->product_id, $desired)) {
                continue;
            }

            /** @var numeric-string $before */
            $before = (string) $requestItem->requested_quantity;
            if (bccomp($before, '0', 6) > 0) {
                $itemChanges[] = [
                    'product_id' => $requestItem->product_id,
                    'type' => 'removed',
                    'before' => $before,
                    'after' => '0.000000',
                    'before_notes' => $requestItem->warehouse_notes,
                    'after_notes' => null,
                ];
            }
        }

        $orderNotesChanged = $order->warehouse_notes !== $request->warehouse_notes;
        $previousOrderNotes = $request->warehouse_notes;
        if ($itemChanges === [] && ! $orderNotesChanged) {
            return;
        }

        $nextVersion = $request->version + 1;
        foreach ($itemChanges as $change) {
            $requestItem = $requestItems->get($change['product_id']);
            if ($requestItem instanceof PosSupplyRequestItem) {
                $requestItem->update([
                    'requested_quantity' => $change['after'],
                    'warehouse_notes' => $change['after_notes'],
                    'change_type' => $change['type'],
                    'changed_version' => $nextVersion,
                ]);
            } else {
                $request->items()->create([
                    'product_id' => $change['product_id'],
                    'requested_quantity' => $change['after'],
                    'prepared_quantity' => '0',
                    'warehouse_notes' => $change['after_notes'],
                    'change_type' => $change['type'],
                    'changed_version' => $nextVersion,
                ]);
            }
        }

        $requestValues = [
            'version' => $nextVersion,
            'status' => 'changes_pending',
            'ready_at' => null,
        ];
        if ($orderNotesChanged) {
            $requestValues['warehouse_notes'] = $order->warehouse_notes;
            $requestValues['warehouse_notes_changed_version'] = $nextVersion;
        }
        $request->update($requestValues);
        $request->changes()->create([
            'version' => $nextVersion,
            'actor_id' => $actorId,
            'type' => 'order_updated',
            'changes' => [
                'order_notes' => $orderNotesChanged ? [
                    'before' => $previousOrderNotes,
                    'after' => $order->warehouse_notes,
                ] : null,
                'items' => $itemChanges,
            ],
        ]);
    }
}
