<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class UpdatePosSupplyRequestItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'expected_version' => ['required', 'integer', 'min:1'],
            'prepared_quantity' => ['required', 'numeric', 'min:0', 'decimal:0,6'],
        ];
    }

    public function expectedVersion(): int
    {
        return $this->integer('expected_version');
    }

    /** @return numeric-string */
    public function preparedQuantity(): string
    {
        /** @var numeric-string $quantity */
        $quantity = $this->string('prepared_quantity')->toString();

        return $quantity;
    }
}
