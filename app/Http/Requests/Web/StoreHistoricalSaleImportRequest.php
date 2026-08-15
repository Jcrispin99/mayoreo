<?php

declare(strict_types=1);

namespace App\Http\Requests\Web;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreHistoricalSaleImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('sales.manage') === true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'warehouse_id' => [
                'required',
                'integer',
                Rule::exists('warehouses', 'id')->where('is_active', true),
            ],
            'document_series_id' => [
                'required',
                'integer',
                Rule::exists('document_series', 'id')->where('is_active', true),
            ],
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240'],
        ];
    }
}
