<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\FiscalDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FiscalDocument
 */
final class FiscalDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sale_id' => $this->sale_id,
            'document_type' => $this->document_type,
            'series_code' => $this->series_code,
            'number' => $this->number,
            'full_number' => "{$this->series_code}-{$this->number}",
            'status' => $this->status,
            'exchanged_from_document_id' => $this->exchanged_from_document_id,
            'issued_at' => $this->issued_at?->toIso8601String(),
        ];
    }
}
