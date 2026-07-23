<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\CloseCashRegisterSessionAction;
use App\Actions\Pos\OpenCashRegisterSessionAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\CloseCashRegisterSessionRequest;
use App\Http\Requests\Api\V1\OpenCashRegisterSessionRequest;
use App\Http\Resources\CashRegisterSessionResource;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CashRegisterSessionController extends ApiController
{
    public function __construct(
        private readonly OpenCashRegisterSessionAction $openAction,
        private readonly CloseCashRegisterSessionAction $closeAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $sessions = CashRegisterSession::query()
            ->with($this->relations())
            ->when($request->filled('cash_register_id'), fn ($query) => $query->where('cash_register_id', $request->integer('cash_register_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->orderByDesc('opened_at')
            ->get();

        return $this->success(CashRegisterSessionResource::collection($sessions));
    }

    public function store(OpenCashRegisterSessionRequest $request, CashRegister $cashRegister): JsonResponse
    {
        $session = $this->openAction->execute(
            $cashRegister,
            $request->openingAmount(),
            $request->openingNotes(),
            $request->user()?->id,
        );

        return $this->created(new CashRegisterSessionResource($this->loadRelations($session)));
    }

    public function show(CashRegisterSession $cashRegisterSession): JsonResponse
    {
        return $this->success(new CashRegisterSessionResource($this->loadRelations($cashRegisterSession)));
    }

    public function close(CloseCashRegisterSessionRequest $request, CashRegisterSession $cashRegisterSession): JsonResponse
    {
        $session = $this->closeAction->execute(
            $cashRegisterSession,
            $request->countedAmount(),
            $request->closingNotes(),
            $request->user()?->id,
        );

        return $this->success(new CashRegisterSessionResource($this->loadRelations($session)), 'Caja cerrada');
    }

    /** @return array<int, string> */
    private function relations(): array
    {
        return [
            'cashRegister.store',
            'cashRegister.warehouse.store',
            'cashRegister.salesSeries',
            'cashRegister.defaultSalesSeries',
            'opener',
            'closer',
            'movements.creator',
        ];
    }

    private function loadRelations(CashRegisterSession $session): CashRegisterSession
    {
        return $session->fresh($this->relations()) ?? $session;
    }
}
