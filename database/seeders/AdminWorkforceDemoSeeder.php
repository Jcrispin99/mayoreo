<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\EmployeeCompensation;
use App\Models\EmployeeProfile;
use App\Models\PayrollLine;
use App\Models\PayrollPeriod;
use App\Models\Store;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

final class AdminWorkforceDemoSeeder extends Seeder
{
    private const ADMIN_EMAIL = 'admin@gmail.com';

    private const DEMO_NOTE = '[DEMO ADMIN]';

    public function run(): void
    {
        DB::transaction(function (): void {
            $timezone = config('payroll.timezone', 'America/Lima');
            assert(is_string($timezone));

            $administrator = User::query()->where('email', self::ADMIN_EMAIL)->firstOrFail();
            $store = Store::query()->firstOrCreate(
                ['code' => 'PRINCIPAL'],
                ['name' => 'Tienda principal', 'is_active' => true],
            );
            $today = CarbonImmutable::now($timezone)->startOfDay();
            $hiredAt = $today->subYear()->startOfMonth();

            $profile = EmployeeProfile::query()->updateOrCreate(
                ['user_id' => $administrator->id],
                [
                    'store_id' => $store->id,
                    'employment_status' => EmployeeProfile::STATUS_ACTIVE,
                    'hired_at' => $hiredAt->toDateString(),
                    'terminated_at' => null,
                    'expected_minutes_per_day' => 840,
                    'monthly_divisor' => 30,
                    'work_days' => [1, 2, 3, 4, 5, 6],
                ],
            );

            $compensation = EmployeeCompensation::query()
                ->where('employee_profile_id', $profile->id)
                ->whereDate('effective_from', $hiredAt->toDateString())
                ->first() ?? new EmployeeCompensation([
                    'employee_profile_id' => $profile->id,
                    'effective_from' => $hiredAt->toDateString(),
                ]);
            $compensation->fill([
                'pay_type' => EmployeeCompensation::TYPE_MONTHLY,
                'amount' => '3500.00',
                'effective_to' => null,
                'created_by' => $administrator->id,
                'notes' => self::DEMO_NOTE.' Remuneración mensual vigente.',
            ])->save();

            foreach ([3, 2, 1] as $monthsAgo) {
                $periodStart = $today->subMonthsNoOverflow($monthsAgo)->startOfMonth();
                $periodEnd = $periodStart->endOfMonth();
                $period = PayrollPeriod::query()
                    ->whereDate('starts_on', $periodStart->toDateString())
                    ->whereDate('ends_on', $periodEnd->toDateString())
                    ->first() ?? new PayrollPeriod([
                        'starts_on' => $periodStart->toDateString(),
                        'ends_on' => $periodEnd->toDateString(),
                    ]);
                $period->fill([
                    'status' => PayrollPeriod::STATUS_CLOSED,
                    'created_by' => $administrator->id,
                    'closed_by' => $administrator->id,
                    'closed_at' => $periodEnd->endOfDay()->utc(),
                ])->save();

                $scheduledDays = $periodStart->daysInMonth;
                PayrollLine::query()->updateOrCreate(
                    [
                        'payroll_period_id' => $period->id,
                        'employee_profile_id' => $profile->id,
                    ],
                    [
                        'pay_type' => EmployeeCompensation::TYPE_MONTHLY,
                        'rate_amount' => '3500.00',
                        'monthly_divisor' => $scheduledDays,
                        'scheduled_days' => $scheduledDays,
                        'valid_days' => $scheduledDays,
                        'absence_days' => 0,
                        'incident_days' => 0,
                        'worked_minutes' => $scheduledDays * 840,
                        'base_amount' => '3500.00',
                        'attendance_deduction' => '0.00',
                        'special_day_bonus' => '0.00',
                        'worked_day_equivalents' => number_format($scheduledDays, 4, '.', ''),
                        'special_day_minutes' => 0,
                        'special_day_details' => [],
                        'calculated_amount' => '3500.00',
                        'adjustments_amount' => '0.00',
                        'payable_amount' => '3500.00',
                        'notes' => self::DEMO_NOTE.' Pago mensual simulado.',
                    ],
                );
            }
        });

        $this->command->info('Perfil laboral demo y tres pagos creados para '.self::ADMIN_EMAIL.'.');
    }
}
