<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\IssueCreditNoteAction;
use App\Actions\Sales\IssueFiscalDocumentPlaceholderAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\IssueFiscalDocumentRequest;
use App\Http\Requests\Api\V1\StoreCreditNoteRequest;
use App\Http\Resources\FiscalDocumentResource;
use App\Models\FiscalDocument;
use App\Models\Sale;
use App\Models\User;
use App\Services\FiscalDocumentTransmissionService;
use Illuminate\Http\JsonResponse;

final class FiscalDocumentController extends ApiController
{
    public function __construct(
        private readonly IssueFiscalDocumentPlaceholderAction $issueFiscalDocumentPlaceholderAction,
        private readonly IssueCreditNoteAction $issueCreditNoteAction,
        private readonly FiscalDocumentTransmissionService $transmissionService,
    ) {}

    public function index(Sale $sale): JsonResponse
    {
        return $this->success(FiscalDocumentResource::collection($sale->fiscalDocuments));
    }

    public function store(IssueFiscalDocumentRequest $request, Sale $sale): JsonResponse
    {
        $document = $this->issueFiscalDocumentPlaceholderAction->execute(
            $sale,
            $request->documentType(),
            $request->documentSeriesId(),
        );

        return $this->created(new FiscalDocumentResource($document), 'Fiscal document issued successfully');
    }

    public function send(FiscalDocument $fiscalDocument): JsonResponse
    {
        $document = $this->transmissionService->send($fiscalDocument);

        return $this->success(
            new FiscalDocumentResource($document),
            'SUNAT transmission processed',
        );
    }

    public function creditNote(StoreCreditNoteRequest $request, FiscalDocument $fiscalDocument): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $creditNote = $this->issueCreditNoteAction->execute(
            $fiscalDocument,
            $request->reasonCode(),
            $request->reasonDescription(),
            $request->creditItems(),
            $user->id,
        );

        return $this->created(new FiscalDocumentResource($creditNote), 'Nota de crédito emitida');
    }
}
