<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\PosPaymentMethod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @property int $warehouse_id
 * @property int|null $customer_id
 * @property int|null $document_series_id
 * @property string|null $customer_name
 * @property string|null $customer_document
 * @property array<int, array{product_id: int, quantity: float|string, unit_id?: int|null, unit_code?: string|null}> $items
 */
final class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'document_series_id' => ['nullable', 'integer', 'exists:document_series,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_document' => ['nullable', 'string', 'max:20'],
            'sold_at' => ['nullable', 'date'],
            'expected_total' => ['nullable', 'string', 'regex:/^\d{1,12}(?:\.\d{1,2})?$/'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*' => ['required', 'array:product_id,quantity,unit_id,unit_code'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['nullable', 'integer', 'exists:units_of_measure,id'],
            'items.*.unit_code' => ['nullable', 'string', 'max:20', 'exists:units_of_measure,code'],
            'payment' => ['sometimes', 'array:method,received_amount,reference,cash_register_session_id'],
            'payment.method' => ['required_with:payment', 'string', Rule::enum(PosPaymentMethod::class)],
            'payment.received_amount' => [
                'required_if:payment.method,cash',
                'prohibited_unless:payment.method,cash',
                'nullable',
                'string',
                'regex:/^\d{1,12}(?:\.\d{1,2})?$/',
            ],
            'payment.reference' => [
                'prohibited_if:payment.method,cash',
                'nullable',
                'string',
                'max:255',
            ],
            'payment.cash_register_session_id' => [
                'required_if:payment.method,cash',
                'prohibited_unless:payment.method,cash',
                'nullable',
                'integer',
                'exists:cash_register_sessions,id',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach ($this->array('items') as $index => $item) {
                if (! is_array($item)) {
                    continue;
                }

                if (! empty($item['unit_id']) && ! empty($item['unit_code'])) {
                    $validator->errors()->add(
                        "items.{$index}.unit_code",
                        'Envía una unidad por id o por código, no ambas.',
                    );
                }
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $payment = $this->input('payment');
        $values = [
            'customer_name' => $this->normalizeOptionalString($this->input('customer_name')),
            'customer_document' => $this->normalizeOptionalString($this->input('customer_document')),
            'notes' => $this->normalizeOptionalString($this->input('notes')),
        ];

        if (is_array($payment) && array_key_exists('reference', $payment)) {
            $reference = $payment['reference'];
            $payment['reference'] = is_string($reference)
                ? Str::of($reference)->trim()->toString() ?: null
                : $reference;
        }

        if (array_key_exists('payment', $this->all())) {
            $values['payment'] = $payment;
        }

        $this->merge($values);
    }

    private function normalizeOptionalString(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        return Str::of($value)->trim()->toString() ?: null;
    }
}
