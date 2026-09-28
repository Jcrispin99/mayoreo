<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Actions\Sales\IssueCreditNoteAction;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreCreditNoteRequest extends FormRequest
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
            'reason_code' => ['required', 'string', Rule::in(array_keys(IssueCreditNoteAction::RETURN_REASON_CODES))],
            'reason_description' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'integer', 'distinct'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,6'],
        ];
    }

    public function reasonCode(): string
    {
        $value = $this->validated('reason_code');
        assert(is_string($value));

        return $value;
    }

    public function reasonDescription(): ?string
    {
        $value = $this->validated('reason_description');

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @return list<array{sale_item_id: int, quantity: numeric-string}>
     */
    public function creditItems(): array
    {
        /** @var list<array{sale_item_id: int, quantity: numeric-string}> $items */
        $items = $this->validated('items');

        return $items;
    }
}
