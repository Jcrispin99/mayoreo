<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\FiscalIssuer;
use App\Rules\ValidPeruvianRuc;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateFiscalIssuerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('fiscal-settings.manage') === true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $fiscalIssuer = $this->route('fiscal_issuer');

        return [
            'ruc' => [
                'sometimes',
                'string',
                new ValidPeruvianRuc,
                Rule::unique('fiscal_issuers', 'ruc')
                    ->ignore($fiscalIssuer instanceof FiscalIssuer ? $fiscalIssuer->id : null),
            ],
            'legal_name' => ['sometimes', 'string', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'fiscal_address' => ['nullable', 'string', 'max:255'],
            'ubigeo' => ['nullable', 'string', 'regex:/^\d{6}$/'],
            'urbanization' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $fiscalIssuer = $this->route('fiscal_issuer');
            $newRuc = $this->input('ruc');

            if (! $fiscalIssuer instanceof FiscalIssuer
                || ! is_string($newRuc)
                || $newRuc === $fiscalIssuer->ruc) {
                return;
            }

            $credential = $fiscalIssuer->credential()->first();

            if ($credential?->hasCertificate() === true
                || $credential?->hasSolCredentials() === true
                || $fiscalIssuer->stores()->exists()
                || $fiscalIssuer->documentSeries()->exists()
                || $fiscalIssuer->fiscalDocuments()->exists()) {
                $validator->errors()->add(
                    'ruc',
                    'No puede cambiar el RUC de un emisor con credenciales, establecimientos, series o documentos fiscales.',
                );
            }
        });
    }
}
