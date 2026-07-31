<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string $sku
 * @property string|null $barcode
 * @property string $name
 * @property string|null $description
 * @property int $base_unit_id
 * @property bool $is_active
 * @property bool $is_favorite
 */
final class UpdateProductRequest extends FormRequest
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
        $product = $this->route('product');

        return [
            'product_template_id' => ['sometimes', 'nullable', 'integer', 'exists:product_templates,id'],
            'sku' => ['sometimes', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($product)],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('products', 'barcode')->ignore($product)],
            'name' => ['sometimes', 'string', 'max:255'],
            'variant_name' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'base_unit_id' => ['sometimes', 'integer', 'exists:units_of_measure,id'],
            'sale_mode' => ['sometimes', 'in:unit,measured'],
            'content_quantity' => ['nullable', 'numeric', 'gt:0', 'required_with:content_unit_id'],
            'content_unit_id' => ['nullable', 'integer', 'exists:units_of_measure,id', 'required_with:content_quantity'],
            'is_active' => ['sometimes', 'boolean'],
            'is_favorite' => ['sometimes', 'boolean'],
            'is_principal' => ['sometimes', 'boolean'],
        ];
    }
}
