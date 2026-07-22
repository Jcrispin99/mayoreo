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
 */
final class StoreUnitOfMeasureRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:20', 'unique:units_of_measure,code'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['weight', 'volume', 'count'])],
        ];
    }
}
