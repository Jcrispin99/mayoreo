<?php

declare(strict_types=1);

use App\Models\AttendanceAdjustment;
use App\Models\AttendanceShift;
use App\Models\EmployeeCompensation;
use App\Models\EmployeeProfile;
use App\Models\PayrollPeriod;
use App\Models\StoreAttendanceQrToken;
use App\Models\User;
use Database\Seeders\AdminWorkforceDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkforceDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

it('seeds repeatable workforce demo data', function (): void {
    Carbon::setTestNow('2026-08-12 15:00:00');

    $this->seed(DatabaseSeeder::class);

    $ana = User::query()->where('email', 'ana.personal@mayoreo.test')->firstOrFail();
    $carla = User::query()->where('email', 'carla.personal@mayoreo.test')->firstOrFail();
    $admin = User::query()->where('email', 'admin@gmail.com')->firstOrFail();
    $period = PayrollPeriod::query()
        ->whereDate('starts_on', '2026-07-01')
        ->whereDate('ends_on', '2026-07-31')
        ->firstOrFail();

    expect(User::query()->whereIn('email', [
        'ana.personal@mayoreo.test',
        'luis.personal@mayoreo.test',
        'carla.personal@mayoreo.test',
    ])->count())->toBe(3)
        ->and(EmployeeProfile::query()->count())->toBe(4)
        ->and($ana->hasRole('cashier'))->toBeTrue()
        ->and($carla->hasRole('manager'))->toBeTrue()
        ->and($ana->employeeProfile?->compensations()->count())->toBe(2)
        ->and($ana->employeeProfile?->compensations()->latest('effective_from')->value('amount'))->toBe('1950.00')
        ->and($period->status)->toBe(PayrollPeriod::STATUS_CLOSED)
        ->and($period->lines()->count())->toBe(4)
        ->and($period->lines()->whereHas('employeeProfile.user', fn ($query) => $query->where('email', $ana->email))->value('payable_amount'))->toBe('1730.00')
        ->and(AttendanceShift::query()->where('status', AttendanceShift::STATUS_INCIDENT)->count())->toBe(1)
        ->and(AttendanceShift::query()->where('status', AttendanceShift::STATUS_OPEN)->count())->toBe(1)
        ->and(AttendanceAdjustment::query()->count())->toBe(1)
        ->and(StoreAttendanceQrToken::query()->count())->toBe(1)
        ->and(StoreAttendanceQrToken::query()->firstOrFail()->encrypted_token)->toBe('demo-personal-principal')
        ->and($admin->employeeProfile)->not->toBeNull()
        ->and($admin->employeeProfile?->expected_minutes_per_day)->toBe(840)
        ->and($admin->employeeProfile?->work_days)->toBe([1, 2, 3, 4, 5, 6])
        ->and($admin->employeeProfile?->compensations()->value('pay_type'))->toBe(EmployeeCompensation::TYPE_MONTHLY)
        ->and($admin->employeeProfile?->compensations()->value('amount'))->toBe('3500.00')
        ->and($admin->employeeProfile?->payrollLines()->count())->toBe(3)
        ->and($admin->employeeProfile?->payrollLines()->sum('payable_amount'))->toBe(10500);

    $counts = [
        User::query()->count(),
        EmployeeProfile::query()->count(),
        AttendanceShift::query()->count(),
        $period->lines()->count(),
    ];

    $this->seed(WorkforceDemoSeeder::class);
    $this->seed(AdminWorkforceDemoSeeder::class);

    expect([
        User::query()->count(),
        EmployeeProfile::query()->count(),
        AttendanceShift::query()->count(),
        $period->lines()->count(),
    ])->toBe($counts);
});
