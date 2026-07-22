<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

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
            'sku' => ['required', 'string', 'max:100', 'unique:products,sku'],
            'barcode' => ['nullable', 'string', 'max:100', 'unique:products,barcode'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'base_unit_id' => ['required', 'integer', 'exists:units_of_measure,id'],
            'is_active' => ['sometimes', 'boolean'],
            'is_favorite' => ['sometimes', 'boolean'],
        ];
    }
}
