<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\FiscalIdentityConfigurationException;
use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Models\Store;
use App\Models\Warehouse;

final class FiscalDocumentIdentityService
{
    /**
     * @return array{
     *     fiscal_issuer_id: int|null,
     *     store_id: int|null,
     *     issuer_ruc: string|null,
     *     issuer_legal_name: string|null,
     *     issuer_trade_name: string|null,
     *     establishment_code: string|null,
     *     establishment_address: string|null,
     *     establishment_ubigeo: string|null,
     *     establishment_urbanization: string|null,
     *     establishment_department: string|null,
     *     establishment_province: string|null,
     *     establishment_district: string|null
     * }
     */
    public function snapshot(Warehouse $warehouse, DocumentSeries $series): array
    {
        $store = $warehouse->store_id === null
            ? null
            : Store::query()->whereKey($warehouse->store_id)->lockForUpdate()->first();

        if (! $store instanceof Store || $store->fiscal_issuer_id === null) {
            if ($series->fiscal_issuer_id !== null) {
                throw FiscalIdentityConfigurationException::seriesIssuerMismatch($series->id);
            }

            return $this->emptySnapshot($store?->id);
        }

        if ($series->fiscal_issuer_id !== $store->fiscal_issuer_id) {
            throw FiscalIdentityConfigurationException::seriesIssuerMismatch($series->id);
        }

        $issuer = FiscalIssuer::query()
            ->whereKey($store->fiscal_issuer_id)
            ->where('is_active', true)
            ->lockForUpdate()
            ->first();

        if (! $issuer instanceof FiscalIssuer) {
            throw FiscalIdentityConfigurationException::inactiveIssuer($store->fiscal_issuer_id);
        }

        if (! $store->hasCompleteSunatAddress()) {
            throw FiscalIdentityConfigurationException::incompleteEstablishment($store->id);
        }

        return [
            'fiscal_issuer_id' => $issuer->id,
            'store_id' => $store->id,
            'issuer_ruc' => $issuer->ruc,
            'issuer_legal_name' => $issuer->legal_name,
            'issuer_trade_name' => $issuer->trade_name,
            'establishment_code' => $store->sunat_establishment_code,
            'establishment_address' => $store->sunat_address,
            'establishment_ubigeo' => $store->sunat_ubigeo,
            'establishment_urbanization' => $store->sunat_urbanization,
            'establishment_department' => $store->sunat_department,
            'establishment_province' => $store->sunat_province,
            'establishment_district' => $store->sunat_district,
        ];
    }

    /**
     * @return array{
     *     fiscal_issuer_id: null,
     *     store_id: int|null,
     *     issuer_ruc: null,
     *     issuer_legal_name: null,
     *     issuer_trade_name: null,
     *     establishment_code: null,
     *     establishment_address: null,
     *     establishment_ubigeo: null,
     *     establishment_urbanization: null,
     *     establishment_department: null,
     *     establishment_province: null,
     *     establishment_district: null
     * }
     */
    private function emptySnapshot(?int $storeId): array
    {
        return [
            'fiscal_issuer_id' => null,
            'store_id' => $storeId,
            'issuer_ruc' => null,
            'issuer_legal_name' => null,
            'issuer_trade_name' => null,
            'establishment_code' => null,
            'establishment_address' => null,
            'establishment_ubigeo' => null,
            'establishment_urbanization' => null,
            'establishment_department' => null,
            'establishment_province' => null,
            'establishment_district' => null,
        ];
    }
}
