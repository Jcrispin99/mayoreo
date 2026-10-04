<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\ProductPurchaseUnit;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property int $supplier_id
 * @property int $warehouse_id
 * @property string $ordered_at
 * @property string|null $invoice_series
 * @property string|null $invoice_number
 * @property string|null $notes
 * @property array<int, array{product_id: int, product_purchase_unit_id: int|null, quantity_purchased: float, unit_cost: float}> $items
 */
final class UpdatePurchaseOrderRequest extends FormRequest
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
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'warehouse_id' => [
                'required',
                'integer',
                Rule::exists('warehouses', 'id')->whereIn('type', ['main', 'retail']),
            ],
            'ordered_at' => ['required', 'date'],
            'invoice_series' => ['nullable', 'string', 'max:20', 'required_with:invoice_number'],
            'invoice_number' => ['nullable', 'string', 'max:100', 'required_with:invoice_series'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_purchase_unit_id' => [
                'nullable',
                'integer',
                'exists:product_purchase_units,id',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null || $value === '') {
                        return;
                    }

                    $index = explode('.', $attribute)[1] ?? null;
                    $productId = $index === null ? null : $this->input("items.{$index}.product_id");
                    if (! is_numeric($productId) || ! ProductPurchaseUnit::query()
                        ->whereKey($value)
                        ->where('product_id', (int) $productId)
                        ->exists()) {
                        $fail('La unidad de compra no pertenece al producto seleccionado.');
                    }
                },
            ],
            'items.*.quantity_purchased' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'gt:0'],
        ];
    }
}
