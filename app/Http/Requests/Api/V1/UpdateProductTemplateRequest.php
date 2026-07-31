<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\Product;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateProductTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'default_price' => ['nullable', 'numeric', 'gt:0'],
            'is_active' => ['sometimes', 'boolean'],
            'is_pos_visible' => ['sometimes', 'boolean'],
            'attributes' => ['sometimes', 'array'],
            'attributes.*.name' => ['required', 'string', 'max:100', 'distinct'],
            'attributes.*.values' => ['required', 'array', 'min:1'],
            'attributes.*.values.*' => ['required', 'string', 'max:100', 'distinct'],
            'attributes.*.value_prices' => ['sometimes', 'array'],
            'attributes.*.value_prices.*' => ['nullable', 'numeric', 'gte:0'],
            'attributes.*.value_factors' => ['sometimes', 'array'],
            'attributes.*.value_factors.*' => ['nullable', 'numeric', 'gt:0'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.id' => ['nullable', 'integer', 'exists:products,id'],
            'variants.*.sku' => [
                'required',
                'string',
                'max:100',
                'distinct',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $index = explode('.', $attribute)[1] ?? null;
                    $id = $index === null ? null : $this->input("variants.{$index}.id");
                    $exists = Product::query()
                        ->where('sku', $value)
                        ->when($id, fn ($query) => $query->where('id', '!=', $id))
                        ->exists();
                    if ($exists) {
                        $fail('El SKU ya está registrado.');
                    }
                },
            ],
            'variants.*.barcode' => [
                'nullable',
                'string',
                'max:100',
                'distinct',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    $index = explode('.', $attribute)[1] ?? null;
                    $id = $index === null ? null : $this->input("variants.{$index}.id");
                    $exists = Product::query()
                        ->where('barcode', $value)
                        ->when($id, fn ($query) => $query->where('id', '!=', $id))
                        ->exists();
                    if ($exists) {
                        $fail('El código de barras ya está registrado.');
                    }
                },
            ],
            'variants.*.variant_name' => ['nullable', 'string', 'max:120'],
            'variants.*.base_unit_id' => ['required', 'integer', 'exists:units_of_measure,id'],
            'variants.*.sale_mode' => ['required', Rule::in(['unit', 'measured'])],
            'variants.*.content_quantity' => ['nullable', 'numeric', 'gt:0', 'required_with:variants.*.content_unit_id'],
            'variants.*.content_unit_id' => ['nullable', 'integer', 'exists:units_of_measure,id', 'required_with:variants.*.content_quantity'],
            'variants.*.is_active' => ['sometimes', 'boolean'],
            'variants.*.is_favorite' => ['sometimes', 'boolean'],
            'variants.*.is_principal' => ['sometimes', 'boolean'],
            'variants.*.attribute_values' => ['sometimes', 'array'],
            'variants.*.attribute_values.*.attribute' => ['required', 'string', 'max:100'],
            'variants.*.attribute_values.*.value' => ['required', 'string', 'max:100'],
            'variants.*.base_price' => ['nullable', 'numeric', 'gt:0'],
            'variants.*.price_tiers' => ['nullable', 'array'],
            'variants.*.price_tiers.*.id' => ['nullable', 'integer', 'exists:price_tiers,id'],
            'variants.*.price_tiers.*.label' => ['nullable', 'string', 'max:255'],
            'variants.*.price_tiers.*.min_quantity' => ['required', 'numeric', 'gte:0'],
            'variants.*.price_tiers.*.max_quantity' => ['nullable', 'numeric', 'gt:0'],
            'variants.*.price_tiers.*.unit_price' => ['required', 'numeric', 'gt:0'],
            'variants.*.price_tiers.*.is_active' => ['sometimes', 'boolean'],
        ];
    }
}
