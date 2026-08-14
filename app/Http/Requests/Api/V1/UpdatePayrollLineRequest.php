<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class UpdatePayrollLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'adjustments_amount' => ['required', 'numeric', 'decimal:0,2'],
            'notes' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    /** @return numeric-string */
    public function adjustmentsAmount(): string
    {
        $value = $this->validated('adjustments_amount');
        assert(is_numeric($value));

        return (string) $value;
    }

    public function notes(): string
    {
        $value = $this->validated('notes');
        assert(is_string($value));

        return $value;
    }
}
