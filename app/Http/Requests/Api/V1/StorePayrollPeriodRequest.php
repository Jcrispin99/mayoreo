<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

final class StorePayrollPeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<mixed>|string> */
    public function rules(): array
    {
        return [
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $start = $this->date('starts_on');
            $end = $this->date('ends_on');
            if ($start?->format('Y-m') !== $end?->format('Y-m')
                || $start?->day !== 1
                || $end?->day !== $end?->daysInMonth) {
                $validator->errors()->add('ends_on', 'La planilla debe cubrir un mes calendario completo.');
            }
        }];
    }

    public function startsOn(): string
    {
        $value = $this->validated('starts_on');
        assert(is_string($value));

        return $value;
    }

    public function endsOn(): string
    {
        $value = $this->validated('ends_on');
        assert(is_string($value));

        return $value;
    }
}
