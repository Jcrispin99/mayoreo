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
final class UpdateUnitOfMeasureRequest extends FormRequest
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
        $unitOfMeasure = $this->route('unit_of_measure');

        return [
            'code' => ['sometimes', 'string', 'max:20', Rule::unique('units_of_measure', 'code')->ignore($unitOfMeasure)],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['weight', 'volume', 'count'])],
        ];
    }
}
