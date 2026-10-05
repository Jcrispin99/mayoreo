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
            'pay_type' => ['required', Rule::in(['monthly', 'weekly'])],
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'expected_minutes' => ['required', 'integer', 'min:1', 'max:44640'],
            'effective_from' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'pay_type.in' => 'La frecuencia de pago debe ser semanal o mensual.',
            'expected_minutes.required' => 'Indica los minutos que debe completar en el periodo de pago.',
            'expected_minutes.min' => 'La meta de tiempo debe ser mayor que cero.',
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

    public function expectedMinutes(): int
    {
        $value = $this->validated('expected_minutes');
        assert(is_int($value));

        return $value;
    }

    public function notes(): ?string
    {
        $value = $this->validated('notes');

        return is_string($value) && $value !== '' ? $value : null;
    }
}
