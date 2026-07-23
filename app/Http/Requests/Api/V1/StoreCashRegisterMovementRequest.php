<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreCashRegisterMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['income', 'expense'])],
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** @return 'income'|'expense' */
    public function movementType(): string
    {
        $value = $this->validated('type');
        assert($value === 'income' || $value === 'expense');

        return $value;
    }

    /** @return numeric-string */
    public function amount(): string
    {
        $value = $this->validated('amount');
        assert(is_numeric($value));

        return (string) $value;
    }

    public function reason(): string
    {
        $value = $this->validated('reason');
        assert(is_string($value));

        return $value;
    }

    public function notes(): ?string
    {
        $value = $this->validated('notes');

        return is_string($value) && $value !== '' ? $value : null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'reason' => mb_trim($this->string('reason')->toString()),
            'notes' => mb_trim($this->string('notes')->toString()) ?: null,
        ]);
    }
}
