<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class AdjustAttendanceShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'clocked_in_at' => ['required', 'date'],
            'clocked_out_at' => ['nullable', 'date', 'after:clocked_in_at'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ];
    }

    public function clockedInAt(): string
    {
        $value = $this->validated('clocked_in_at');
        assert(is_string($value));

        return $value;
    }

    public function clockedOutAt(): ?string
    {
        $value = $this->validated('clocked_out_at');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function reason(): string
    {
        $value = $this->validated('reason');
        assert(is_string($value));

        return $value;
    }
}
