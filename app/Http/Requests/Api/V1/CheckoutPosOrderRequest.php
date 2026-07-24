<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\PosPaymentMethod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class CheckoutPosOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'expected_total' => ['required', 'string', 'regex:/^\d{1,12}(?:\.\d{1,2})?$/'],
            'payment' => ['required', 'array:method,received_amount,reference'],
            'payment.method' => ['required', 'string', Rule::enum(PosPaymentMethod::class)],
            'payment.received_amount' => [
                'required_if:payment.method,cash',
                'prohibited_unless:payment.method,cash',
                'nullable',
                'string',
                'regex:/^\d{1,12}(?:\.\d{1,2})?$/',
            ],
            'payment.reference' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return numeric-string */
    public function expectedTotal(): string
    {
        $value = $this->validated('expected_total');

        return is_string($value) && is_numeric($value) ? $value : '0';
    }

    public function paymentMethod(): string
    {
        $value = $this->validated('payment.method');

        return is_string($value) ? $value : '';
    }

    /** @return numeric-string|null */
    public function receivedAmount(): ?string
    {
        $value = $this->validated('payment.received_amount');

        return is_string($value) && is_numeric($value) ? $value : null;
    }

    public function paymentReference(): ?string
    {
        $value = $this->validated('payment.reference');

        return is_string($value) && $value !== '' ? $value : null;
    }

    protected function prepareForValidation(): void
    {
        $reference = $this->input('payment.reference');

        if (is_string($reference)) {
            $this->merge([
                'payment' => [
                    ...$this->array('payment'),
                    'reference' => Str::of($reference)->trim()->toString() ?: null,
                ],
            ]);
        }
    }
}
