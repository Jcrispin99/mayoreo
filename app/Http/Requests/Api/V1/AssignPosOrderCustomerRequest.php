<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

final class AssignPosOrderCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'customer_id' => ['present', 'nullable', 'integer', 'exists:customers,id'],
        ];
    }

    public function customerId(): ?int
    {
        $customerId = $this->validated('customer_id');

        return is_numeric($customerId) ? (int) $customerId : null;
    }
}
