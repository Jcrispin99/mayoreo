<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreEmployeeCompensationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'pay_type' => ['required', Rule::in(['monthly', 'daily'])],
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'effective_from' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function payType(): string
    {
        $value = $this->validated('pay_type');
        assert(is_string($value));

        return $value;
    }

    /** @return numeric-string */
    public function amount(): string
    {
        $value = $this->validated('amount');
        assert(is_numeric($value));

        return (string) $value;
    }

    public function effectiveFrom(): string
    {
        $value = $this->validated('effective_from');
        assert(is_string($value));

        return $value;
    }

    public function notes(): ?string
    {
        $value = $this->validated('notes');

        return is_string($value) && $value !== '' ? $value : null;
    }
}
