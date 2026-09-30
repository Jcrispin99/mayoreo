<?php

declare(strict_types=1);

namespace App\Http\Requests\Web;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateAttendanceLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'attendance_latitude' => ['required', 'numeric', 'between:-90,90'],
            'attendance_longitude' => ['required', 'numeric', 'between:-180,180'],
            'attendance_radius_meters' => ['required', 'integer', 'between:20,1000'],
        ];
    }
}
