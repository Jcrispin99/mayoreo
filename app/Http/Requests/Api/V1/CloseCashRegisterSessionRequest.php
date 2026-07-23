<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class CloseCashRegisterSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'counted_amount' => ['required', 'numeric', 'min:0', 'decimal:0,2'],
            'closing_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return numeric-string */
    public function countedAmount(): string
    {
        $value = $this->validated('counted_amount');
        assert(is_numeric($value));

        return (string) $value;
    }

    public function closingNotes(): ?string
    {
        $value = $this->validated('closing_notes');

        return is_string($value) && $value !== '' ? $value : null;
    }
}
