<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\SaveDocumentSeriesRequest;
use App\Http\Resources\DocumentSeriesResource;
use App\Models\DocumentSeries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DocumentSeriesController extends ApiController
{
    private const SALES_TYPES = ['sales_ticket', 'receipt', 'invoice'];

    public function index(Request $request): JsonResponse
    {
        $series = DocumentSeries::query()
            ->with('cashRegisters')
            ->whereIn('document_type', self::SALES_TYPES)
            ->when($request->filled('document_type'), fn ($query) => $query->where('document_type', $request->string('document_type')))
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('document_type')
            ->orderBy('series_code')
            ->get();

        return $this->success(DocumentSeriesResource::collection($series));
    }

    public function store(SaveDocumentSeriesRequest $request): JsonResponse
    {
        $series = DocumentSeries::query()->create($request->validated());

        return $this->created(new DocumentSeriesResource($series->load('cashRegisters')));
    }

    public function show(DocumentSeries $documentSeries): JsonResponse
    {
        return $this->success(new DocumentSeriesResource($documentSeries->load('cashRegisters')));
    }

    public function update(SaveDocumentSeriesRequest $request, DocumentSeries $documentSeries): JsonResponse
    {
        $documentSeries->update($request->validated());

        return $this->success(new DocumentSeriesResource($documentSeries->load('cashRegisters')), 'Serie actualizada');
    }
}
