<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class UpdatePosOrderItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,6'],
            'unit_code' => ['sometimes', 'nullable', 'string', 'max:20'],
        ];
    }

    /** @return numeric-string */
    public function quantity(): string
    {
        /** @var numeric-string $quantity */
        $quantity = $this->string('quantity')->toString();

        return $quantity;
    }

    public function unitCode(): ?string
    {
        $unitCode = $this->input('unit_code');

        return is_string($unitCode) && $unitCode !== '' ? $unitCode : null;
    }

    protected function prepareForValidation(): void
    {
        $unitCode = $this->input('unit_code');

        if (is_string($unitCode)) {
            $this->merge(['unit_code' => mb_strtolower(mb_trim($unitCode))]);
        }
    }
}
