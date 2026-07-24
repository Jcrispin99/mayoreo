<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Concerns;

use Illuminate\Support\Str;

trait NormalizesCustomerInput
{
    protected function prepareForValidation(): void
    {
        $input = $this->all();
        $normalized = [];

        foreach (['name', 'document_number', 'phone', 'email', 'address'] as $field) {
            if (! array_key_exists($field, $input) || ! is_string($input[$field])) {
                continue;
            }

            $value = Str::of($input[$field])->trim();

            if ($field === 'email') {
                $value = $value->lower();
            }

            $normalized[$field] = $field !== 'name' && $value->isEmpty()
                ? null
                : $value->toString();
        }

        $this->merge($normalized);
    }
}
