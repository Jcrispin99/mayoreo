<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\DocumentSeries;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class SaveDocumentSeriesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        $series = $this->route('document_series');

        return [
            'fiscal_issuer_id' => [
                'required',
                'integer',
                Rule::exists('fiscal_issuers', 'id')->where('is_active', true),
            ],
            'document_type' => ['required', Rule::in(['sales_ticket', 'receipt', 'invoice'])],
            'series_code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('document_series', 'series_code')
                    ->where(
                        fn (Builder $query): Builder => $query
                            ->where('fiscal_issuer_id', $this->integer('fiscal_issuer_id'))
                            ->where('document_type', $this->string('document_type')->toString())
                    )
                    ->ignore($series instanceof DocumentSeries ? $series->id : null),
            ],
            'current_number' => ['required', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $series = $this->route('document_series');

            if (! $series instanceof DocumentSeries) {
                return;
            }

            $identityIsLocked = $series->current_number > 0
                || $series->cashRegisters()->exists();

            if (! $identityIsLocked) {
                return;
            }

            if ($this->integer('fiscal_issuer_id') !== $series->fiscal_issuer_id) {
                $validator->errors()->add(
                    'fiscal_issuer_id',
                    'No se puede cambiar el emisor de una serie asignada o que ya está en uso.',
                );
            }

            if ($this->string('document_type')->toString() !== $series->document_type) {
                $validator->errors()->add('document_type', 'No se puede cambiar el tipo de una serie que ya está en uso.');
            }

            if ($this->string('series_code')->toString() !== $series->series_code) {
                $validator->errors()->add('series_code', 'No se puede cambiar una serie que ya emitió documentos.');
            }

            if ($this->integer('current_number') !== $series->current_number) {
                $validator->errors()->add('current_number', 'No se puede modificar un correlativo que ya está en uso.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'series_code' => mb_strtoupper(mb_trim($this->string('series_code')->toString())),
        ]);
    }
}
