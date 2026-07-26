<?php

declare(strict_types=1);

namespace App\Rules;

use App\Support\PeruvianRuc;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class ValidPeruvianRuc implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! PeruvianRuc::isValid($value)) {
            $fail('El campo :attribute debe ser un RUC peruano válido.');
        }
    }
}
