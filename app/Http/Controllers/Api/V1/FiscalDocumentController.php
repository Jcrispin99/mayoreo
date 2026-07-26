<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\IssueFiscalDocumentPlaceholderAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\IssueFiscalDocumentRequest;
use App\Http\Resources\FiscalDocumentResource;
use App\Models\FiscalDocument;
use App\Models\Sale;
use App\Services\FiscalDocumentTransmissionService;
use Illuminate\Http\JsonResponse;

final class FiscalDocumentController extends ApiController
{
    public function __construct(
        private readonly IssueFiscalDocumentPlaceholderAction $issueFiscalDocumentPlaceholderAction,
        private readonly FiscalDocumentTransmissionService $transmissionService,
    ) {}

    public function index(Sale $sale): JsonResponse
    {
        return $this->success(FiscalDocumentResource::collection($sale->fiscalDocuments));
    }

    public function store(IssueFiscalDocumentRequest $request, Sale $sale): JsonResponse
    {
        $document = $this->issueFiscalDocumentPlaceholderAction->execute($sale, $request->string('document_type')->toString());

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
}
