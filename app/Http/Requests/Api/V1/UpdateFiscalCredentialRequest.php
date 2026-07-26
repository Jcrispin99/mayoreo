<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\SunatEnvironment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateFiscalCredentialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('fiscal-credentials.manage') === true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'environment' => ['sometimes', Rule::enum(SunatEnvironment::class)],
            'sol_username' => ['sometimes', 'string', 'min:1', 'max:100'],
            'sol_password' => ['sometimes', 'string', 'min:1', 'max:255'],
        ];
    }
}
