<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\Store;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->hasFiscalConfigurationInput()) {
            return $this->user()?->can('fiscal-settings.manage') === true;
        }

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $store = $this->route('store');

        return [
            'fiscal_issuer_id' => [
                'nullable',
                'integer',
                Rule::exists('fiscal_issuers', 'id')->where('is_active', true),
            ],
            'code' => ['sometimes', 'string', 'max:30', Rule::unique('stores', 'code')->ignore($store)],
            'name' => ['sometimes', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'sunat_establishment_code' => [
                'nullable',
                'string',
                'regex:/^\d{4}$/',
                Rule::unique('stores', 'sunat_establishment_code')
                    ->where(
                        fn (Builder $query): Builder => $query
                            ->where('fiscal_issuer_id', $this->input(
                                'fiscal_issuer_id',
                                $store instanceof Store ? $store->fiscal_issuer_id : null,
                            ))
                    )
                    ->ignore($store instanceof Store ? $store->id : null),
            ],
            'sunat_address' => ['nullable', 'string', 'max:255'],
            'sunat_ubigeo' => ['nullable', 'string', 'regex:/^\d{6}$/'],
            'sunat_urbanization' => ['nullable', 'string', 'max:100'],
            'sunat_department' => ['nullable', 'string', 'max:100'],
            'sunat_province' => ['nullable', 'string', 'max:100'],
            'sunat_district' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $store = $this->route('store');

            if (! $store instanceof Store) {
                return;
            }

            $input = $this->all();
            $disconnectingIssuer = array_key_exists('fiscal_issuer_id', $input)
                && $this->input('fiscal_issuer_id') === null;
            $fiscalIssuerId = array_key_exists('fiscal_issuer_id', $input)
                ? $this->input('fiscal_issuer_id')
                : $store->fiscal_issuer_id;
            $establishmentCode = array_key_exists('sunat_establishment_code', $input)
                ? $this->input('sunat_establishment_code')
                : ($disconnectingIssuer ? null : $store->sunat_establishment_code);
            $effectiveAddress = [];

            foreach ([
                'sunat_address',
                'sunat_ubigeo',
                'sunat_department',
                'sunat_province',
                'sunat_district',
            ] as $field) {
                $effectiveAddress[$field] = array_key_exists($field, $input)
                    ? $this->input($field)
                    : ($disconnectingIssuer ? null : $store->getAttribute($field));
            }

            $effectiveUrbanization = array_key_exists('sunat_urbanization', $input)
                ? $this->input('sunat_urbanization')
                : ($disconnectingIssuer ? null : $store->sunat_urbanization);

            if ($fiscalIssuerId !== null && $establishmentCode === null) {
                $validator->errors()->add(
                    'sunat_establishment_code',
                    'El código de establecimiento SUNAT es obligatorio al vincular un emisor fiscal.'
                );
            }

            foreach ($effectiveAddress as $field => $value) {
                if ($fiscalIssuerId !== null && ($value === null || $value === '')) {
                    $validator->errors()->add(
                        $field,
                        'Este campo es obligatorio para completar la dirección del establecimiento SUNAT.',
                    );
                }
            }

            $hasAddressData = $effectiveUrbanization !== null;

            foreach ($effectiveAddress as $value) {
                if ($value !== null && $value !== '') {
                    $hasAddressData = true;
                    break;
                }
            }

            if ($fiscalIssuerId === null && ($establishmentCode !== null || $hasAddressData)) {
                $validator->errors()->add(
                    'fiscal_issuer_id',
                    'Debe seleccionar un emisor fiscal para configurar el establecimiento SUNAT.'
                );
            }

            if ($fiscalIssuerId !== $store->fiscal_issuer_id
                && $store->cashRegisters()
                    ->whereHas('salesSeries', function ($query) use ($fiscalIssuerId): void {
                        if ($fiscalIssuerId === null) {
                            $query->whereNotNull('fiscal_issuer_id');

                            return;
                        }

                        $query->where(function ($query) use ($fiscalIssuerId): void {
                            $query
                                ->whereNull('fiscal_issuer_id')
                                ->orWhere('fiscal_issuer_id', '!=', $fiscalIssuerId);
                        });
                    })
                    ->exists()) {
                $validator->errors()->add(
                    'fiscal_issuer_id',
                    'Reconfigure primero las series de las cajas antes de cambiar el emisor fiscal de la tienda.',
                );
            }

            if ($fiscalIssuerId !== null
                && $establishmentCode !== null
                && $this->hasFiscalConfigurationInput()
                && Store::query()
                    ->where('fiscal_issuer_id', $fiscalIssuerId)
                    ->where('sunat_establishment_code', $establishmentCode)
                    ->whereKeyNot($store->id)
                    ->exists()) {
                $validator->errors()->add(
                    'sunat_establishment_code',
                    'El código de establecimiento ya está asignado a otra tienda del emisor.'
                );
            }
        });
    }

    private function hasFiscalConfigurationInput(): bool
    {
        $input = $this->all();

        foreach ([
            'fiscal_issuer_id',
            'sunat_establishment_code',
            'sunat_address',
            'sunat_ubigeo',
            'sunat_urbanization',
            'sunat_department',
            'sunat_province',
            'sunat_district',
        ] as $field) {
            if (array_key_exists($field, $input)) {
                return true;
            }
        }

        return false;
    }
}
