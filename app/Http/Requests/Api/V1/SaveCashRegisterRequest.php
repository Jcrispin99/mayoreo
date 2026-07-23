<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\CashRegister;
use App\Models\Warehouse;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class SaveCashRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        $cashRegister = $this->route('cash_register');

        return [
            'store_id' => ['required', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
            'warehouse_id' => ['required', 'integer', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'default_sales_series_id' => [
                'required',
                'integer',
                Rule::exists('document_series', 'id')->where(
                    fn (Builder $query): Builder => $query
                        ->where('is_active', true)
                        ->whereIn('document_type', ['sales_ticket', 'receipt', 'invoice'])
                ),
            ],
            'sales_series_ids' => ['required', 'array', 'min:1'],
            'sales_series_ids.*' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('document_series', 'id')->where(
                    fn (Builder $query): Builder => $query
                        ->where('is_active', true)
                        ->whereIn('document_type', ['sales_ticket', 'receipt', 'invoice'])
                ),
            ],
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('cash_registers', 'code')
                    ->where(fn (Builder $query): Builder => $query->where('store_id', $this->integer('store_id')))
                    ->ignore($cashRegister instanceof CashRegister ? $cashRegister->id : null),
            ],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $warehouse = Warehouse::query()->find($this->integer('warehouse_id'));

            if ($warehouse instanceof Warehouse && $warehouse->store_id !== $this->integer('store_id')) {
                $validator->errors()->add('warehouse_id', 'El almacén debe pertenecer a la tienda seleccionada.');
            }

            $seriesInput = $this->input('sales_series_ids', []);
            if (! is_array($seriesInput)) {
                return;
            }

            $seriesIds = array_values(array_map('intval', array_filter($seriesInput, 'is_numeric')));
            if (! in_array($this->integer('default_sales_series_id'), $seriesIds, true)) {
                $validator->errors()->add('default_sales_series_id', 'La serie predeterminada debe estar entre las series seleccionadas.');
            }

            $cashRegister = $this->route('cash_register');
            $assignmentQuery = DB::table('cash_register_document_series')
                ->whereIn('document_series_id', $seriesIds);

            if ($cashRegister instanceof CashRegister) {
                $assignmentQuery->where('cash_register_id', '!=', $cashRegister->id);
            }

            $assigned = $assignmentQuery->exists();

            if ($assigned) {
                $validator->errors()->add('sales_series_ids', 'Una de las series seleccionadas ya está asignada a otra caja.');
            }

        });
    }

    /** @return array<int, int> */
    public function salesSeriesIds(): array
    {
        $series = $this->validated('sales_series_ids');

        if (! is_array($series)) {
            return [];
        }

        $ids = [];
        foreach ($series as $value) {
            if (is_numeric($value)) {
                $ids[] = (int) $value;
            }
        }

        return $ids;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'code' => mb_strtoupper(mb_trim($this->string('code')->toString())),
        ]);
    }
}
