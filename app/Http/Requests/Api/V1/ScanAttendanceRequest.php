<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class ScanAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'qr_payload' => ['required', 'string', 'max:255'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function qrPayload(): string
    {
        $value = $this->validated('qr_payload');
        assert(is_string($value));

        return $value;
    }

    public function deviceId(): ?string
    {
        $value = $this->validated('device_id');

        return is_string($value) && $value !== '' ? $value : null;
    }
}
