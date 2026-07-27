<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\Models\InventoryTransfer;
use Illuminate\Support\Facades\DB;

/**
 * Despacha y recibe un traslado en un solo paso ("marcar listo"), para
 * flujos donde quien prepara la mercadería es quien la entrega, sin un
 * tránsito físico separado que alguien más deba confirmar después.
 *
 * A diferencia del despacho manual, esto se usa para comandas del POS:
 * si el almacén de origen tampoco tiene el stock que el sistema cree
 * tener, igual se despacha (el stock queda negativo) para que la
 * operación no se detenga — la misma tolerancia que ya existe para las
 * ventas normales.
 */
final readonly class ResolveInventoryTransferAction
{
    public function __construct(
        private DispatchTransferAction $dispatchTransferAction,
        private ReceiveTransferAction $receiveTransferAction,
    ) {}

    public function execute(InventoryTransfer $inventoryTransfer, ?int $resolvedBy): InventoryTransfer
    {
        return DB::transaction(function () use ($inventoryTransfer, $resolvedBy): InventoryTransfer {
            $dispatched = $this->dispatchTransferAction->execute($inventoryTransfer, $resolvedBy, allowNegative: true);

            return $this->receiveTransferAction->execute($dispatched, $resolvedBy);
        });
    }
}
