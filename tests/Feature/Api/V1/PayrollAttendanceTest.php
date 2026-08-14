<?php

declare(strict_types=1);

use App\Models\AttendanceAdjustment;
use App\Models\AttendanceShift;
use App\Models\EmployeeCompensation;
use App\Models\EmployeeProfile;
use App\Models\Store;
use App\Models\StoreAttendanceQrToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->manager = User::factory()->create();
    grantApiPermissions(
        $this->manager,
        'employees.view', 'employees.manage',
        'attendance.view', 'attendance.manage', 'attendance-qr.manage',
        'payroll.view', 'payroll.manage',
    );
    $this->managerHeaders = [
        'Authorization' => 'Bearer '.$this->manager->createToken('manager')->plainTextToken,
    ];
    $this->store = Store::factory()->create();
});

afterEach(function (): void {
    Carbon::setTestNow();
});

it('creates a labor profile and preserves compensation history', function (): void {
    $worker = User::factory()->create();

    $profile = $this->withHeaders($this->managerHeaders)
        ->putJson("/api/v1/users/{$worker->id}/employee-profile", [
            'store_id' => $this->store->id,
            'employment_status' => 'active',
            'hired_at' => '2026-08-01',
            'terminated_at' => null,
            'expected_minutes_per_day' => 480,
            'monthly_divisor' => 30,
            'work_days' => [0, 1, 2, 3, 4, 5, 6],
        ])->assertOk()
        ->assertJsonPath('data.user_id', $worker->id)
        ->assertJsonPath('data.store_id', $this->store->id)
        ->json('data');

    $this->withHeaders($this->managerHeaders)
        ->postJson("/api/v1/employees/{$profile['id']}/compensations", [
            'pay_type' => 'monthly',
            'amount' => 1500,
            'effective_from' => '2026-08-01',
            'notes' => 'Sueldo inicial',
        ])->assertCreated();

    $this->withHeaders($this->managerHeaders)
        ->postJson("/api/v1/employees/{$profile['id']}/compensations", [
            'pay_type' => 'monthly',
            'amount' => 1800,
            'effective_from' => '2026-09-01',
            'notes' => 'Aumento',
        ])->assertCreated();

    expect(EmployeeCompensation::query()->orderBy('effective_from')->get())
        ->toHaveCount(2)
        ->and(EmployeeCompensation::query()->oldest('effective_from')->first()?->effective_to?->toDateString())
        ->toBe('2026-08-31');
});

it('alternates QR scans between entry and exit using server time', function (): void {
    $worker = User::factory()->create();
    grantApiPermissions($worker, 'attendance.mark', 'attendance.view-own');
    EmployeeProfile::query()->create([
        'user_id' => $worker->id,
        'store_id' => $this->store->id,
        'employment_status' => 'active',
        'hired_at' => '2026-08-01',
        'expected_minutes_per_day' => 480,
        'monthly_divisor' => 30,
        'work_days' => [0, 1, 2, 3, 4, 5, 6],
    ]);
    $workerHeaders = ['Authorization' => 'Bearer '.$worker->createToken('worker')->plainTextToken];
    $payload = $this->withHeaders($this->managerHeaders)
        ->postJson("/api/v1/stores/{$this->store->id}/attendance-qr/rotate")
        ->assertOk()->json('data.payload');

    $this->withHeaders($this->managerHeaders)
        ->getJson("/api/v1/stores/{$this->store->id}/attendance-qr")
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.recoverable', true)
        ->assertJsonPath('data.payload', $payload);

    $storedToken = $this->store->attendanceQrToken()->firstOrFail();
    $rawToken = str_replace((string) config('payroll.qr_prefix'), '', $payload);
    expect($storedToken->getRawOriginal('encrypted_token'))->not->toBe($rawToken)
        ->and($storedToken->encrypted_token)->toBe($rawToken);

    $this->app['auth']->forgetGuards();
    Carbon::setTestNow(Carbon::parse('2026-08-12 13:00:00', 'UTC'));
    expect($worker->fresh()?->can('attendance.mark'))->toBeTrue();
    $this->withHeaders($workerHeaders)->postJson('/api/v1/attendance/scan', [
        'qr_payload' => $payload,
        'device_id' => 'phone-1',
    ])->assertCreated()
        ->assertJsonPath('data.action', 'entry')
        ->assertJsonPath('data.shift.status', 'open');

    $this->withHeaders($workerHeaders)->postJson('/api/v1/attendance/scan', [
        'qr_payload' => $payload,
        'device_id' => 'phone-1',
    ])->assertUnprocessable();

    Carbon::setTestNow(Carbon::parse('2026-08-12 22:00:00', 'UTC'));
    $this->withHeaders($workerHeaders)->postJson('/api/v1/attendance/scan', [
        'qr_payload' => $payload,
        'device_id' => 'phone-1',
    ])->assertCreated()
        ->assertJsonPath('data.action', 'exit')
        ->assertJsonPath('data.shift.status', 'completed')
        ->assertJsonPath('data.shift.worked_minutes', 540);

    $this->assertDatabaseCount('attendance_events', 2);
    $this->assertDatabaseHas('attendance_events', ['type' => 'entry', 'source' => 'qr']);
    $this->assertDatabaseHas('attendance_events', ['type' => 'exit', 'source' => 'qr']);
});

it('identifies legacy QR tokens that cannot be recovered', function (): void {
    StoreAttendanceQrToken::query()->create([
        'store_id' => $this->store->id,
        'token_hash' => hash('sha256', 'legacy-token'),
        'rotated_by' => $this->manager->id,
        'rotated_at' => now(),
    ]);

    $this->withHeaders($this->managerHeaders)
        ->getJson("/api/v1/stores/{$this->store->id}/attendance-qr")
        ->assertOk()
        ->assertJsonPath('data.configured', true)
        ->assertJsonPath('data.recoverable', false)
        ->assertJsonPath('data.payload', null);
});

it('records manual attendance corrections with an immutable audit reason', function (): void {
    $worker = User::factory()->create();
    $employee = EmployeeProfile::query()->create([
        'user_id' => $worker->id,
        'store_id' => $this->store->id,
        'employment_status' => 'active',
        'hired_at' => '2026-08-01',
        'expected_minutes_per_day' => 480,
        'monthly_divisor' => 30,
        'work_days' => [0, 1, 2, 3, 4, 5, 6],
    ]);

    $shift = $this->withHeaders($this->managerHeaders)->postJson('/api/v1/attendance-shifts', [
        'employee_profile_id' => $employee->id,
        'store_id' => $this->store->id,
        'clocked_in_at' => '2026-08-10T08:00:00-05:00',
        'clocked_out_at' => '2026-08-10T17:00:00-05:00',
        'reason' => 'Olvidó marcar ese día',
    ])->assertCreated()->json('data');

    $this->withHeaders($this->managerHeaders)->patchJson("/api/v1/attendance-shifts/{$shift['id']}", [
        'clocked_in_at' => '2026-08-10T08:15:00-05:00',
        'clocked_out_at' => '2026-08-10T17:00:00-05:00',
        'reason' => 'Se verificó la hora correcta',
    ])->assertOk()->assertJsonPath('data.worked_minutes', 525);

    expect(AttendanceAdjustment::query()->count())->toBe(2)
        ->and(AttendanceAdjustment::query()->latest('id')->first()?->reason)->toBe('Se verificó la hora correcta');
});

it('calculates daily payroll, keeps manual adjustments and freezes a closed period', function (): void {
    $worker = User::factory()->create();
    grantApiPermissions($worker, 'payroll.view-own');
    $employee = EmployeeProfile::query()->create([
        'user_id' => $worker->id,
        'store_id' => $this->store->id,
        'employment_status' => 'active',
        'hired_at' => '2026-08-01',
        'expected_minutes_per_day' => 480,
        'monthly_divisor' => 30,
        'work_days' => [0, 1, 2, 3, 4, 5, 6],
    ]);
    $employee->compensations()->create([
        'pay_type' => 'daily',
        'amount' => 100,
        'effective_from' => '2026-08-01',
        'created_by' => $this->manager->id,
    ]);
    foreach ([10, 11] as $day) {
        AttendanceShift::query()->create([
            'employee_profile_id' => $employee->id,
            'store_id' => $this->store->id,
            'clocked_in_at' => "2026-08-{$day}T13:00:00Z",
            'clocked_out_at' => "2026-08-{$day}T22:00:00Z",
            'worked_minutes' => 540,
            'status' => 'completed',
            'source' => 'qr',
        ]);
    }

    $period = $this->withHeaders($this->managerHeaders)->postJson('/api/v1/payroll-periods', [
        'starts_on' => '2026-08-01',
        'ends_on' => '2026-08-31',
    ])->assertCreated()
        ->assertJsonPath('data.lines.0.valid_days', 2)
        ->assertJsonPath('data.lines.0.calculated_amount', '200.00')
        ->json('data');
    $lineId = $period['lines'][0]['id'];

    $this->withHeaders($this->managerHeaders)
        ->patchJson("/api/v1/payroll-periods/{$period['id']}/lines/{$lineId}", [
            'adjustments_amount' => 25,
            'notes' => 'Bono acordado',
        ])->assertOk()->assertJsonPath('data.payable_amount', '225.00');

    $this->withHeaders($this->managerHeaders)
        ->postJson("/api/v1/payroll-periods/{$period['id']}/close")
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.lines.0.payable_amount', '225.00');

    $this->withHeaders($this->managerHeaders)
        ->getJson("/api/v1/employees/{$employee->id}/payroll-lines")
        ->assertOk()
        ->assertJsonPath('data.0.employee_profile_id', $employee->id)
        ->assertJsonPath('data.0.period.status', 'closed');

    $this->withHeaders($this->managerHeaders)
        ->patchJson("/api/v1/payroll-periods/{$period['id']}/lines/{$lineId}", [
            'adjustments_amount' => 50,
            'notes' => 'Cambio tardío',
        ])->assertUnprocessable();

    $workerHeaders = ['Authorization' => 'Bearer '.$worker->createToken('worker-payroll')->plainTextToken];
    $this->app['auth']->forgetGuards();
    $this->withHeaders($workerHeaders)->getJson('/api/v1/payroll/mine')
        ->assertOk()
        ->assertJsonPath('data.0.payable_amount', '225.00');
});

it('deducts monthly absences using the calendar days in the period', function (): void {
    $worker = User::factory()->create();
    $employee = EmployeeProfile::query()->create([
        'user_id' => $worker->id,
        'store_id' => $this->store->id,
        'employment_status' => 'active',
        'hired_at' => '2026-08-01',
        'expected_minutes_per_day' => 480,
        'monthly_divisor' => 30,
        'work_days' => [0, 1, 2, 3, 4, 5, 6],
    ]);
    $employee->compensations()->create([
        'pay_type' => 'monthly',
        'amount' => 3000,
        'effective_from' => '2026-08-01',
    ]);
    foreach (range(1, 30) as $day) {
        $date = sprintf('2026-08-%02d', $day);
        AttendanceShift::query()->create([
            'employee_profile_id' => $employee->id,
            'store_id' => $this->store->id,
            'clocked_in_at' => "{$date}T13:00:00Z",
            'clocked_out_at' => "{$date}T21:00:00Z",
            'worked_minutes' => 480,
            'status' => 'completed',
            'source' => 'qr',
        ]);
    }

    $this->withHeaders($this->managerHeaders)->postJson('/api/v1/payroll-periods', [
        'starts_on' => '2026-08-01',
        'ends_on' => '2026-08-31',
    ])->assertCreated()
        ->assertJsonPath('data.lines.0.valid_days', 30)
        ->assertJsonPath('data.lines.0.absence_days', 1)
        ->assertJsonPath('data.lines.0.monthly_divisor', 31)
        ->assertJsonPath('data.lines.0.attendance_deduction', '96.77')
        ->assertJsonPath('data.lines.0.calculated_amount', '2903.23');
});

it('applies a proportional special-day bonus from worked minutes', function (): void {
    $worker = User::factory()->create();
    $employee = EmployeeProfile::query()->create([
        'user_id' => $worker->id,
        'store_id' => $this->store->id,
        'employment_status' => 'active',
        'hired_at' => '2026-08-01',
        'expected_minutes_per_day' => 480,
        'monthly_divisor' => 30,
        'work_days' => [0, 1, 2, 3, 4, 5, 6],
    ]);
    $employee->compensations()->create([
        'pay_type' => 'monthly',
        'amount' => 3100,
        'effective_from' => '2026-08-01',
    ]);

    $this->withHeaders($this->managerHeaders)->postJson('/api/v1/special-days', [
        'date' => '2026-08-15',
        'name' => 'Día especial de tienda',
        'bonus_percentage' => 100,
    ])->assertCreated()->assertJsonPath('data.bonus_percentage', 100);

    foreach (range(1, 31) as $day) {
        $date = sprintf('2026-08-%02d', $day);
        $minutes = $day === 15 ? 240 : 480;
        AttendanceShift::query()->create([
            'employee_profile_id' => $employee->id,
            'store_id' => $this->store->id,
            'clocked_in_at' => "{$date}T13:00:00Z",
            'clocked_out_at' => Carbon::parse("{$date}T13:00:00Z")->addMinutes($minutes),
            'worked_minutes' => $minutes,
            'status' => 'completed',
            'source' => 'qr',
        ]);
    }

    $this->withHeaders($this->managerHeaders)->postJson('/api/v1/payroll-periods', [
        'starts_on' => '2026-08-01',
        'ends_on' => '2026-08-31',
    ])->assertCreated()
        ->assertJsonPath('data.lines.0.base_amount', '3100.00')
        ->assertJsonPath('data.lines.0.attendance_deduction', '50.00')
        ->assertJsonPath('data.lines.0.special_day_bonus', '50.00')
        ->assertJsonPath('data.lines.0.special_day_minutes', 240)
        ->assertJsonPath('data.lines.0.worked_day_equivalents', '30.5000')
        ->assertJsonPath('data.lines.0.special_day_details.0.amount', '50.00')
        ->assertJsonPath('data.lines.0.calculated_amount', '3100.00');
});

it('requires dedicated permissions for payroll administration', function (): void {
    $ordinary = User::factory()->create();
    $headers = ['Authorization' => 'Bearer '.$ordinary->createToken('ordinary')->plainTextToken];

    $this->withHeaders($headers)->getJson('/api/v1/payroll-periods')->assertForbidden();
    $this->withHeaders($headers)->getJson('/api/v1/attendance-shifts')->assertForbidden();
});

it('does not expose compensation data with personnel permissions alone', function (): void {
    $viewer = User::factory()->create();
    grantApiPermissions($viewer, 'employees.view');
    $worker = User::factory()->create();
    $employee = EmployeeProfile::query()->create([
        'user_id' => $worker->id,
        'store_id' => $this->store->id,
        'employment_status' => 'active',
        'hired_at' => '2026-08-01',
        'expected_minutes_per_day' => 480,
        'monthly_divisor' => 30,
        'work_days' => [0, 1, 2, 3, 4, 5, 6],
    ]);
    $employee->compensations()->create([
        'pay_type' => 'monthly',
        'amount' => 2000,
        'effective_from' => '2026-08-01',
    ]);
    $headers = ['Authorization' => 'Bearer '.$viewer->createToken('viewer')->plainTextToken];

    $this->withHeaders($headers)->getJson('/api/v1/employees')
        ->assertOk()
        ->assertJsonMissingPath('data.0.compensations');
});
