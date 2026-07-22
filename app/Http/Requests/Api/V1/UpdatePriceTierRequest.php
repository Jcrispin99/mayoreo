<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @property float $min_quantity
 * @property float|null $max_quantity
 * @property float $unit_price
 * @property string|null $label
 * @property bool $is_active
 */
final class UpdatePriceTierRequest extends FormRequest
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
            'min_quantity' => ['sometimes', 'numeric', 'gte:0'],
            'max_quantity' => ['nullable', 'numeric', 'gt:min_quantity'],
            'unit_price' => ['sometimes', 'numeric', 'gt:0'],
            'label' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
