<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SaveSpecialDayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date', Rule::unique('special_days', 'date')->ignore($this->route('special_day'))],
            'name' => ['required', 'string', 'max:150'],
            'bonus_percentage' => ['required', 'integer', Rule::in([50, 100])],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
