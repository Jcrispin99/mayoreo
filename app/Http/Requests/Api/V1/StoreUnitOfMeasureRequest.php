<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'code' => ['required', 'string', Rule::in(['NIU', 'kg']), 'unique:units_of_measure,code'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['weight', 'count'])],
        ];
    }

    /** @return array<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $validPair = ($this->input('code') === 'NIU' && $this->input('type') === 'count')
                || ($this->input('code') === 'kg' && $this->input('type') === 'weight');

            if (! $validPair) {
                $validator->errors()->add('type', 'Unidad debe ser de conteo y kg debe ser de peso.');
            }
        }];
    }
}
