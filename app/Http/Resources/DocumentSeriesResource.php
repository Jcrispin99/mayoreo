<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\DocumentSeries;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DocumentSeries */
final class DocumentSeriesResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'fiscal_issuer_id' => $this->fiscal_issuer_id,
            'document_type' => $this->document_type,
            'purpose' => $this->purpose,
            'series_code' => $this->series_code,
            'current_number' => $this->current_number,
            'next_number' => $this->current_number + 1,
            'is_active' => $this->is_active,
            'assigned_cash_register_id' => $this->whenLoaded('cashRegisters', fn (): ?int => $this->cashRegisters->first()?->id),
        ];
    }
}
