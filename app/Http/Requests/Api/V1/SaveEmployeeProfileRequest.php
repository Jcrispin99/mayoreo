<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SaveEmployeeProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'store_id' => ['nullable', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
            'employment_status' => ['required', Rule::in(['active', 'inactive'])],
            'hired_at' => ['required', 'date'],
            'terminated_at' => ['nullable', 'date', 'after_or_equal:hired_at'],
            'expected_minutes_per_day' => ['required', 'integer', 'min:1', 'max:1440'],
            'monthly_divisor' => ['required', 'integer', 'min:1', 'max:31'],
            'work_days' => ['required', 'array', 'min:1', 'max:7'],
            'work_days.*' => ['required', 'integer', 'distinct', 'between:0,6'],
        ];
    }
}
