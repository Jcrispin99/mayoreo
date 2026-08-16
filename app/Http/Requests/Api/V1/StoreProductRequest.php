<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
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
final class StoreProductRequest extends FormRequest
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
            'product_template_id' => ['nullable', 'integer', 'exists:product_templates,id'],
            'sku' => ['required', 'string', 'max:100', 'unique:products,sku'],
            'barcode' => ['nullable', 'string', 'max:100', 'unique:products,barcode'],
            'name' => ['required', 'string', 'max:255'],
            'variant_name' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'base_unit_id' => [
                'required',
                'integer',
                Rule::exists('units_of_measure', 'id')->where(
                    fn (Builder $query): Builder => $query->whereIn('code', ['NIU', 'kg']),
                ),
            ],
            'sale_mode' => ['sometimes', 'in:unit,measured'],
            'content_quantity' => ['nullable', 'numeric', 'gt:0', 'required_with:content_unit_id'],
            'content_unit_id' => [
                'nullable',
                'integer',
                Rule::exists('units_of_measure', 'id')->where(
                    fn (Builder $query): Builder => $query->where('code', 'kg'),
                ),
                'required_with:content_quantity',
            ],
            'is_active' => ['sometimes', 'boolean'],
            'is_favorite' => ['sometimes', 'boolean'],
            'is_principal' => ['sometimes', 'boolean'],
        ];
    }
}
