<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\IssueCreditNoteAction;
use App\Actions\Sales\IssueFiscalDocumentPlaceholderAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\IssueFiscalDocumentRequest;
use App\Http\Requests\Api\V1\StoreCreditNoteRequest;
use App\Http\Requests\Api\V1\StoreFiscalDocumentDeliveryRequest;
use App\Http\Resources\FiscalDocumentResource;
use App\Models\FiscalDocument;
use App\Models\FiscalDocumentDelivery;
use App\Models\Sale;
use App\Models\User;
use App\Services\FiscalDocumentRepresentationService;
use App\Services\FiscalDocumentTransmissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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

    public function representation(
        FiscalDocument $fiscalDocument,
        FiscalDocumentRepresentationService $representationService,
    ): JsonResponse {
        return $this->success([
            'html' => $representationService->render($fiscalDocument)->render(),
            'filename' => sprintf(
                '%s-%08d.pdf',
                $fiscalDocument->series_code,
                $fiscalDocument->number,
            ),
        ]);
    }

    public function deliver(
        StoreFiscalDocumentDeliveryRequest $request,
        FiscalDocument $fiscalDocument,
    ): JsonResponse {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $phone = $request->normalizedPhone();
        $delivery = FiscalDocumentDelivery::query()->create([
            'fiscal_document_id' => $fiscalDocument->id,
            'channel' => 'whatsapp',
            'destination' => $phone,
            'access_token' => Str::random(64),
            'created_by' => $user->id,
        ]);
        $publicUrl = $this->publicReceiptUrl($request, $delivery->access_token);
        $documentNumber = sprintf(
            '%s-%08d',
            $fiscalDocument->series_code,
            $fiscalDocument->number,
        );
        $documentLabel = match ($fiscalDocument->document_type) {
            'receipt' => 'boleta electrónica',
            'invoice' => 'factura electrónica',
            'credit_note' => 'nota de crédito electrónica',
            default => 'nota de venta',
        };
        $sale = $fiscalDocument->sale()->firstOrFail();
        $total = $sale->payable_total;
        $message = sprintf(
            'Hola, le enviamos su %s %s por S/ %s: %s',
            $documentLabel,
            $documentNumber,
            number_format((float) $total, 2, '.', ''),
            $publicUrl,
        );

        return $this->created([
            'id' => $delivery->id,
            'phone' => $phone,
            'public_url' => $publicUrl,
            'whatsapp_url' => 'https://wa.me/'.mb_substr($phone, 1).'?text='.rawurlencode($message),
            'created_at' => $delivery->created_at?->toIso8601String(),
        ], 'Enlace de WhatsApp preparado');
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

    private function publicReceiptUrl(Request $request, string $token): string
    {
        return mb_rtrim($request->getSchemeAndHttpHost(), '/').'/comprobantes/'.$token;
    }
}
