<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\PayrollPeriod;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'pay_frequency' => ['required', Rule::in([
                PayrollPeriod::FREQUENCY_MONTHLY,
                PayrollPeriod::FREQUENCY_WEEKLY,
            ])],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $start = $this->date('starts_on');
            $end = $this->date('ends_on');
            if ($start === null || $end === null) {
                return;
            }
            $frequency = $this->string('pay_frequency')->toString();
            if ($frequency === PayrollPeriod::FREQUENCY_MONTHLY
                && ($start->format('Y-m') !== $end->format('Y-m')
                    || $start->day !== 1
                    || $end->day !== $end->daysInMonth)) {
                $validator->errors()->add('ends_on', 'La planilla debe cubrir un mes calendario completo.');
            }
            if ($frequency === PayrollPeriod::FREQUENCY_WEEKLY
                && ($start->dayOfWeekIso !== 1 || ! $start->copy()->addDays(6)->isSameDay($end))) {
                $validator->errors()->add('ends_on', 'La planilla semanal debe cubrir de lunes a domingo.');
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

    public function payFrequency(): string
    {
        $value = $this->validated('pay_frequency');
        assert(is_string($value));

        return $value;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('pay_frequency')) {
            $this->merge(['pay_frequency' => PayrollPeriod::FREQUENCY_MONTHLY]);
        }
    }
}
