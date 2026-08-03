<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class UpdatePosOrderWarehouseNotesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return ['warehouse_notes' => ['nullable', 'string', 'max:1000']];
    }

    public function warehouseNotes(): ?string
    {
        $value = $this->validated('warehouse_notes');

        return is_string($value) && $value !== '' ? $value : null;
    }

    protected function prepareForValidation(): void
    {
        $value = $this->input('warehouse_notes');
        if (is_string($value)) {
            $trimmed = mb_trim($value);
            $this->merge(['warehouse_notes' => $trimmed !== '' ? $trimmed : null]);
        }
    }
}
