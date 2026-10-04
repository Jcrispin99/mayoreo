<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

final class StoreFiscalDocumentDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'max:30'],
        ];
    }

    public function normalizedPhone(): string
    {
        $validated = $this->validated('phone');

        if (! is_string($validated)) {
            throw ValidationException::withMessages([
                'phone' => 'Ingresa un número de WhatsApp válido.',
            ]);
        }

        $raw = mb_trim($validated);
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if (str_starts_with($digits, '00')) {
            $digits = mb_substr($digits, 2);
        }

        if (preg_match('/^9\d{8}$/D', $digits) === 1) {
            $digits = '51'.$digits;
        }

        if (preg_match('/^[1-9]\d{7,14}$/D', $digits) !== 1) {
            throw ValidationException::withMessages([
                'phone' => 'Ingresa un celular válido. Para Perú puedes usar 9 dígitos o +51.',
            ]);
        }

        return '+'.$digits;
    }
}
