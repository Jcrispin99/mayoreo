<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $document_type
 * @property int|null $document_series_id
 */
final class IssueFiscalDocumentRequest extends FormRequest
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
            'document_type' => ['nullable', 'required_without:document_series_id', Rule::in(['receipt', 'invoice'])],
            'document_series_id' => [
                'nullable',
                'required_without:document_type',
                'integer',
                Rule::exists('document_series', 'id')->where(
                    fn (Builder $query): Builder => $query
                        ->whereIn('document_type', ['receipt', 'invoice'])
                        ->where('is_active', true),
                ),
            ],
        ];
    }

    public function documentType(): ?string
    {
        $value = $this->validated('document_type');

        return is_string($value) ? $value : null;
    }

    public function documentSeriesId(): ?int
    {
        return $this->filled('document_series_id')
            ? $this->integer('document_series_id')
            : null;
    }
}
