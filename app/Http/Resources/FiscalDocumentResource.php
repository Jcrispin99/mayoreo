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
            'fiscal_issuer_id' => $this->fiscal_issuer_id,
            'store_id' => $this->store_id,
            'document_type' => $this->document_type,
            'series_code' => $this->series_code,
            'number' => $this->number,
            'full_number' => sprintf('%s-%d', $this->series_code, $this->number),
            'status' => $this->status,
            'sunat' => [
                'status' => $this->sunat_status,
                'attempts' => $this->sunat_attempts,
                'error_code' => $this->sunat_error_code,
                'error_message' => $this->sunat_error_message,
                'cdr_code' => $this->cdr_code,
                'cdr_description' => $this->cdr_description,
                'cdr_notes' => $this->cdr_notes ?? [],
                'has_xml' => filled($this->xml_path),
                'xml_hash' => $this->xml_hash,
                'has_cdr' => filled($this->cdr_path),
                'sent_at' => $this->sunat_sent_at?->toIso8601String(),
                'responded_at' => $this->sunat_responded_at?->toIso8601String(),
            ],
            'exchanged_from_document_id' => $this->exchanged_from_document_id,
            'has_fiscal_identity_snapshot' => $this->hasFiscalIdentitySnapshot(),
            'issuer' => $this->fiscal_issuer_id === null ? null : [
                'id' => $this->fiscal_issuer_id,
                'ruc' => $this->issuer_ruc,
                'legal_name' => $this->issuer_legal_name,
                'trade_name' => $this->issuer_trade_name,
            ],
            'establishment' => $this->fiscal_issuer_id === null ? null : [
                'store_id' => $this->store_id,
                'code' => $this->establishment_code,
                'address' => $this->establishment_address,
                'ubigeo' => $this->establishment_ubigeo,
                'urbanization' => $this->establishment_urbanization,
                'department' => $this->establishment_department,
                'province' => $this->establishment_province,
                'district' => $this->establishment_district,
            ],
            'issued_at' => $this->issued_at->toIso8601String(),
        ];
    }
}
