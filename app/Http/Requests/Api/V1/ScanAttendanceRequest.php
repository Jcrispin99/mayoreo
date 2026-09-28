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
            'device_id' => ['required', 'string', 'max:128'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0', 'max:10000'],
        ];
    }

    public function qrPayload(): string
    {
        $value = $this->validated('qr_payload');
        assert(is_string($value));

        return $value;
    }

    public function deviceId(): string
    {
        $value = $this->validated('device_id');
        assert(is_string($value));

        return $value;
    }

    /** @return array{latitude: float, longitude: float, accuracy: float} */
    public function location(): array
    {
        return [
            'latitude' => (float) $this->validated('latitude'),
            'longitude' => (float) $this->validated('longitude'),
            'accuracy' => (float) $this->validated('accuracy'),
        ];
    }
}
