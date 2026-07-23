<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListPosCatalogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'cursor' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'filters' => ['sometimes', 'array', 'max:10'],
            'filters.*' => [
                'string',
                'distinct',
                Rule::in([
                    'favorite',
                    'with-barcode',
                    'type:weight',
                    'type:volume',
                    'type:count',
                    'stock:positive',
                    'stock:zero',
                    'stock:negative',
                    'price:configured',
                    'price:missing',
                ]),
            ],
        ];
    }

    public function catalogSearch(): string
    {
        return mb_trim($this->string('search')->toString());
    }

    /** @return list<string> */
    public function catalogFilters(): array
    {
        $filters = $this->validated('filters', []);

        if (! is_array($filters)) {
            return [];
        }

        return array_values(array_filter($filters, 'is_string'));
    }

    public function perPage(): int
    {
        return $this->integer('per_page', 24);
    }
}
