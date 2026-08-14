<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AttendanceAdjustment;
use App\Models\AttendanceEvent;
use App\Models\AttendanceShift;
use App\Models\EmployeeCompensation;
use App\Models\EmployeeProfile;
use App\Models\PayrollLine;
use App\Models\PayrollPeriod;
use App\Models\Store;
use App\Models\StoreAttendanceQrToken;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

final class WorkforceDemoSeeder extends Seeder
{
    private const DEMO_NOTE = '[DEMO PERSONAL]';

    private const QR_TOKEN = 'demo-personal-principal';

    public function run(): void
    {
        $demoQrAvailable = false;
        DB::transaction(function () use (&$demoQrAvailable): void {
            $timezone = config('payroll.timezone', 'America/Lima');
            assert(is_string($timezone));
            $today = CarbonImmutable::now($timezone)->startOfDay();
            $periodStart = $today->subMonthNoOverflow()->startOfMonth();
            $periodEnd = $periodStart->endOfMonth();
            $store = $this->store();
            $administrator = User::query()->where('email', 'admin@mayoreo.test')->first();

            $employees = [
                'ana' => $this->employee(
                    store: $store,
                    administrator: $administrator,
                    name: 'Ana Torres',
                    email: 'ana.personal@mayoreo.test',
                    role: 'cashier',
                    hiredAt: $periodStart->subMonths(8),
                    payType: EmployeeCompensation::TYPE_MONTHLY,
                    amount: '1800.00',
                ),
                'luis' => $this->employee(
                    store: $store,
                    administrator: $administrator,
                    name: 'Luis Mendoza',
                    email: 'luis.personal@mayoreo.test',
                    role: 'warehouse',
                    hiredAt: $periodStart->subMonths(5),
                    payType: EmployeeCompensation::TYPE_DAILY,
                    amount: '70.00',
                ),
                'carla' => $this->employee(
                    store: $store,
                    administrator: $administrator,
                    name: 'Carla Rojas',
                    email: 'carla.personal@mayoreo.test',
                    role: 'manager',
                    hiredAt: $periodStart->subYear(),
                    payType: EmployeeCompensation::TYPE_MONTHLY,
                    amount: '2400.00',
                ),
            ];

            $this->seedSalaryIncrease($employees['ana'], $administrator, $periodEnd);

            $this->seedHistoricalAttendance($employees, $store, $periodStart, $periodEnd);
            $this->seedRecentAttendance($employees, $store, $today);
            $this->seedPayroll($employees, $administrator, $periodStart, $periodEnd);
            $demoQrAvailable = $this->seedQr($store, $administrator);
        });

        $prefix = config('payroll.qr_prefix', 'mayoreo-attendance:');
        assert(is_string($prefix));
        $this->command->info('Personal demo: ana.personal@mayoreo.test, luis.personal@mayoreo.test y carla.personal@mayoreo.test (clave: password).');
        if ($demoQrAvailable) {
            $this->command->info('QR demo: '.$prefix.self::QR_TOKEN);
        } else {
            $this->command->warn('La tienda ya tenía otro QR de asistencia; se conservó sin cambios.');
        }
    }

    private function store(): Store
    {
        return Store::query()->firstOrCreate(
            ['code' => 'PRINCIPAL'],
            ['name' => 'Tienda principal', 'is_active' => true],
        );
    }

    private function employee(
        Store $store,
        ?User $administrator,
        string $name,
        string $email,
        string $role,
        CarbonImmutable $hiredAt,
        string $payType,
        string $amount,
    ): EmployeeProfile {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => Hash::make('password')],
        );
        $user->forceFill(['name' => $name, 'email_verified_at' => now()])->save();

        $existingRole = Role::query()->where('name', $role)->where('guard_name', 'web')->first();
        if ($existingRole instanceof Role) {
            $user->syncRoles([$existingRole]);
        }

        $profile = EmployeeProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'store_id' => $store->id,
                'employment_status' => EmployeeProfile::STATUS_ACTIVE,
                'hired_at' => $hiredAt->toDateString(),
                'terminated_at' => null,
                'expected_minutes_per_day' => 480,
                'monthly_divisor' => 30,
                'work_days' => [0, 1, 2, 3, 4, 5, 6],
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
            'pay_type' => $payType,
            'amount' => $amount,
            'effective_to' => null,
            'created_by' => $administrator?->id,
            'notes' => self::DEMO_NOTE.' Remuneración inicial.',
        ])->save();

        return $profile;
    }

    private function seedSalaryIncrease(EmployeeProfile $employee, ?User $administrator, CarbonImmutable $periodEnd): void
    {
        $initialCompensation = $employee->compensations()->oldest('effective_from')->firstOrFail();
        $initialCompensation->update(['effective_to' => $periodEnd->toDateString()]);

        $effectiveFrom = $periodEnd->addDay();
        $currentCompensation = EmployeeCompensation::query()
            ->where('employee_profile_id', $employee->id)
            ->whereDate('effective_from', $effectiveFrom->toDateString())
            ->first() ?? new EmployeeCompensation([
                'employee_profile_id' => $employee->id,
                'effective_from' => $effectiveFrom->toDateString(),
            ]);
        $currentCompensation->fill([
            'pay_type' => EmployeeCompensation::TYPE_MONTHLY,
            'amount' => '1950.00',
            'effective_to' => null,
            'created_by' => $administrator?->id,
            'notes' => self::DEMO_NOTE.' Aumento vigente desde el mes actual.',
        ])->save();
    }

    /** @param array{ana: EmployeeProfile, luis: EmployeeProfile, carla: EmployeeProfile} $employees */
    private function seedHistoricalAttendance(
        array $employees,
        Store $store,
        CarbonImmutable $periodStart,
        CarbonImmutable $periodEnd,
    ): void {
        for ($date = $periodStart; $date->lessThanOrEqualTo($periodEnd); $date = $date->addDay()) {
            $day = $date->day;

            if (! in_array($day, [5, 12], true)) {
                $this->completedShift($employees['ana'], $store, $date, 8, 0, 16, 0);
            } elseif ($day === 12) {
                $this->incidentShift($employees['ana'], $store, $date);
            }

            if (! in_array($day, [3, 10], true)) {
                $this->completedShift($employees['luis'], $store, $date, 7, 30, 15, 30);
            }

            $this->completedShift($employees['carla'], $store, $date, 9, 0, 17, 0);
        }
    }

    /** @param array{ana: EmployeeProfile, luis: EmployeeProfile, carla: EmployeeProfile} $employees */
    private function seedRecentAttendance(array $employees, Store $store, CarbonImmutable $today): void
    {
        $firstDate = $today->startOfMonth()->max($today->subDays(6));
        for ($date = $firstDate; $date->lessThan($today); $date = $date->addDay()) {
            $this->completedShift($employees['ana'], $store, $date, 8, 0, 16, 0);
            $this->completedShift($employees['luis'], $store, $date, 7, 30, 15, 30);
            $this->completedShift($employees['carla'], $store, $date, 9, 0, 17, 0);
        }

        $adjustedDate = $today->day === 1
            ? $today->subMonthNoOverflow()->startOfMonth()->addDays(7)
            : $today->subDay();
        $shift = $this->completedShift($employees['ana'], $store, $adjustedDate, 8, 0, 16, 0);
        AttendanceAdjustment::query()->updateOrCreate(
            ['attendance_shift_id' => $shift->id, 'reason' => self::DEMO_NOTE.' Corrección de tardanza autorizada.'],
            [
                'adjusted_by' => User::query()->where('email', 'manager@mayoreo.test')->value('id'),
                'previous_clocked_in_at' => $adjustedDate->setTime(8, 20)->utc(),
                'previous_clocked_out_at' => $adjustedDate->setTime(16, 0)->utc(),
                'new_clocked_in_at' => $adjustedDate->setTime(8, 0)->utc(),
                'new_clocked_out_at' => $adjustedDate->setTime(16, 0)->utc(),
            ],
        );

        $clockIn = $today->setTime(9, 0)->utc();
        $openShift = AttendanceShift::query()->updateOrCreate(
            ['employee_profile_id' => $employees['carla']->id, 'clocked_in_at' => $clockIn],
            [
                'store_id' => $store->id,
                'clocked_out_at' => null,
                'worked_minutes' => null,
                'status' => AttendanceShift::STATUS_OPEN,
                'source' => 'qr',
            ],
        );
        $this->event($openShift, 'entry', $clockIn);
    }

    private function completedShift(
        EmployeeProfile $employee,
        Store $store,
        CarbonImmutable $date,
        int $entryHour,
        int $entryMinute,
        int $exitHour,
        int $exitMinute,
    ): AttendanceShift {
        $clockIn = $date->setTime($entryHour, $entryMinute)->utc();
        $clockOut = $date->setTime($exitHour, $exitMinute)->utc();
        $workedMinutes = $clockIn->diffInMinutes($clockOut);
        $shift = AttendanceShift::query()->updateOrCreate(
            ['employee_profile_id' => $employee->id, 'clocked_in_at' => $clockIn],
            [
                'store_id' => $store->id,
                'clocked_out_at' => $clockOut,
                'worked_minutes' => $workedMinutes,
                'status' => AttendanceShift::STATUS_COMPLETED,
                'source' => 'qr',
            ],
        );
        $this->event($shift, 'entry', $clockIn);
        $this->event($shift, 'exit', $clockOut);

        return $shift;
    }

    private function incidentShift(EmployeeProfile $employee, Store $store, CarbonImmutable $date): void
    {
        $clockIn = $date->setTime(8, 0)->utc();
        $clockOut = $date->setTime(20, 30)->utc();
        $shift = AttendanceShift::query()->updateOrCreate(
            ['employee_profile_id' => $employee->id, 'clocked_in_at' => $clockIn],
            [
                'store_id' => $store->id,
                'clocked_out_at' => $clockOut,
                'worked_minutes' => $clockIn->diffInMinutes($clockOut),
                'status' => AttendanceShift::STATUS_INCIDENT,
                'source' => 'qr',
            ],
        );
        $this->event($shift, 'entry', $clockIn);
        $this->event($shift, 'exit', $clockOut, ['incident' => 'Turno prolongado pendiente de revisión']);
    }

    /** @param array<string, mixed>|null $metadata */
    private function event(AttendanceShift $shift, string $type, CarbonImmutable $occurredAt, ?array $metadata = null): void
    {
        AttendanceEvent::query()->updateOrCreate(
            ['attendance_shift_id' => $shift->id, 'type' => $type],
            [
                'employee_profile_id' => $shift->employee_profile_id,
                'store_id' => $shift->store_id,
                'occurred_at' => $occurredAt,
                'source' => 'qr',
                'recorded_by' => null,
                'metadata' => $metadata ?? ['demo' => true],
            ],
        );
    }

    /** @param array{ana: EmployeeProfile, luis: EmployeeProfile, carla: EmployeeProfile} $employees */
    private function seedPayroll(
        array $employees,
        ?User $administrator,
        CarbonImmutable $periodStart,
        CarbonImmutable $periodEnd,
    ): void {
        $period = PayrollPeriod::query()
            ->whereDate('starts_on', $periodStart->toDateString())
            ->whereDate('ends_on', $periodEnd->toDateString())
            ->first();
        $createdPeriod = ! $period instanceof PayrollPeriod;
        if ($createdPeriod) {
            $period = PayrollPeriod::query()->create([
                'starts_on' => $periodStart->toDateString(),
                'ends_on' => $periodEnd->toDateString(),
                'status' => PayrollPeriod::STATUS_CLOSED,
                'created_by' => $administrator?->id,
                'closed_by' => $administrator?->id,
                'closed_at' => $periodEnd->endOfDay()->utc(),
            ]);
        }

        $isDemoPeriod = $createdPeriod
            || $period->lines()->where('notes', 'like', self::DEMO_NOTE.'%')->exists();
        if (! $isDemoPeriod) {
            $this->command->warn('Se omitió la planilla demo porque ya existe un período para el mes anterior.');

            return;
        }

        $days = $periodStart->daysInMonth;
        $this->payrollLine($period, $employees['ana'], 'monthly', '1800.00', $days, $days - 2, 2, 1, '1680.00', '50.00');
        $this->payrollLine($period, $employees['luis'], 'daily', '70.00', $days, $days - 2, 2, 0, bcmul((string) ($days - 2), '70.00', 2));
        $this->payrollLine($period, $employees['carla'], 'monthly', '2400.00', $days, $days, 0, 0, '2400.00');
    }

    /**
     * @param  numeric-string  $rate
     * @param  numeric-string  $calculated
     * @param  numeric-string  $adjustment
     */
    private function payrollLine(
        PayrollPeriod $period,
        EmployeeProfile $employee,
        string $payType,
        string $rate,
        int $scheduledDays,
        int $validDays,
        int $absenceDays,
        int $incidentDays,
        string $calculated,
        string $adjustment = '0.00',
    ): void {
        PayrollLine::query()->updateOrCreate(
            ['payroll_period_id' => $period->id, 'employee_profile_id' => $employee->id],
            [
                'pay_type' => $payType,
                'rate_amount' => $rate,
                'monthly_divisor' => $payType === EmployeeCompensation::TYPE_MONTHLY ? $period->starts_on->daysInMonth : null,
                'scheduled_days' => $scheduledDays,
                'valid_days' => $validDays,
                'absence_days' => $absenceDays,
                'incident_days' => $incidentDays,
                'worked_minutes' => $validDays * 480,
                'base_amount' => $payType === EmployeeCompensation::TYPE_MONTHLY ? $rate : $calculated,
                'attendance_deduction' => $payType === EmployeeCompensation::TYPE_MONTHLY
                    ? bcsub($rate, $calculated, 2)
                    : '0.00',
                'special_day_bonus' => '0.00',
                'worked_day_equivalents' => number_format($validDays, 4, '.', ''),
                'special_day_minutes' => 0,
                'special_day_details' => [],
                'calculated_amount' => $calculated,
                'adjustments_amount' => $adjustment,
                'payable_amount' => bcadd($calculated, $adjustment, 2),
                'notes' => self::DEMO_NOTE.' Planilla histórica para pruebas.',
            ],
        );
    }

    private function seedQr(Store $store, ?User $administrator): bool
    {
        $tokenHash = hash('sha256', self::QR_TOKEN);
        $existingToken = StoreAttendanceQrToken::query()->where('store_id', $store->id)->first();
        if ($existingToken instanceof StoreAttendanceQrToken) {
            if (! hash_equals($existingToken->token_hash, $tokenHash)) {
                return false;
            }

            $existingToken->update(['encrypted_token' => self::QR_TOKEN]);

            return true;
        }

        StoreAttendanceQrToken::query()->create([
            'store_id' => $store->id,
            'token_hash' => $tokenHash,
            'encrypted_token' => self::QR_TOKEN,
            'rotated_by' => $administrator?->id,
            'rotated_at' => now(),
        ]);

        return true;
    }
}
