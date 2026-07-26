<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\FiscalIssuer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FiscalIssuer
 */
final class FiscalIssuerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $configurationComplete = $this->is_active
            && $this->relationLoaded('credential')
            && $this->credential?->configurationIsComplete() === true;

        return [
            'id' => $this->id,
            'ruc' => $this->ruc,
            'legal_name' => $this->legal_name,
            'trade_name' => $this->trade_name,
            'fiscal_address' => $this->fiscal_address,
            'ubigeo' => $this->ubigeo,
            'urbanization' => $this->urbanization,
            'department' => $this->department,
            'province' => $this->province,
            'district' => $this->district,
            'phone' => $this->phone,
            'email' => $this->email,
            'is_active' => $this->is_active,
            'configuration_complete' => $configurationComplete,
            'stores_count' => $this->whenCounted('stores'),
            'credentials' => $this->whenLoaded(
                'credential',
                fn (): ?FiscalCredentialResource => $this->credential === null
                    ? null
                    : new FiscalCredentialResource($this->credential)
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
