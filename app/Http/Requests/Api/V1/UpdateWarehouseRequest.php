<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string $code
 * @property string $name
 * @property string $type
 * @property bool $is_active
 */
final class UpdateWarehouseRequest extends FormRequest
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
        $warehouse = $this->route('warehouse');

        return [
            'code' => ['sometimes', 'string', 'max:50', Rule::unique('warehouses', 'code')->ignore($warehouse)],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['main', 'retail', 'pos'])],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }
}
