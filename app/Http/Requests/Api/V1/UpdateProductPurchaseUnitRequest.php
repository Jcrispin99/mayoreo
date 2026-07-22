<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @property string $name
 * @property float $conversion_factor
 * @property string|null $barcode
 * @property bool $is_default_purchase
 */
final class UpdateProductPurchaseUnitRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:255'],
            'conversion_factor' => ['sometimes', 'numeric', 'gt:0'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'is_default_purchase' => ['sometimes', 'boolean'],
        ];
    }
}
