<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Actions\Pos\CompletePosOrderResult;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CompletePosOrderResult */
final class PosCheckoutResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'order' => new PosOrderResource($this->order),
            'sale' => new SaleResource($this->sale),
            'payment' => new SalePaymentResource($this->payment),
            'fiscal_document' => new FiscalDocumentResource($this->fiscalDocument),
        ];
    }
}
