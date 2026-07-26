<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreStoreRequest extends FormRequest
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
        return [
            'fiscal_issuer_id' => [
                'nullable',
                'integer',
                'required_with:sunat_establishment_code,sunat_address,sunat_ubigeo,sunat_urbanization,sunat_department,sunat_province,sunat_district',
                Rule::exists('fiscal_issuers', 'id')->where('is_active', true),
            ],
            'code' => ['required', 'string', 'max:30', 'unique:stores,code'],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'sunat_establishment_code' => [
                'nullable',
                'string',
                'regex:/^\d{4}$/',
                'required_with:fiscal_issuer_id',
                Rule::unique('stores', 'sunat_establishment_code')
                    ->where(
                        fn (Builder $query): Builder => $query
                            ->where('fiscal_issuer_id', $this->input('fiscal_issuer_id'))
                    ),
            ],
            'sunat_address' => ['nullable', 'string', 'max:255', 'required_with:fiscal_issuer_id'],
            'sunat_ubigeo' => ['nullable', 'string', 'regex:/^\d{6}$/', 'required_with:fiscal_issuer_id'],
            'sunat_urbanization' => ['nullable', 'string', 'max:100'],
            'sunat_department' => ['nullable', 'string', 'max:100', 'required_with:fiscal_issuer_id'],
            'sunat_province' => ['nullable', 'string', 'max:100', 'required_with:fiscal_issuer_id'],
            'sunat_district' => ['nullable', 'string', 'max:100', 'required_with:fiscal_issuer_id'],
            'is_active' => ['sometimes', 'boolean'],
        ];
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
