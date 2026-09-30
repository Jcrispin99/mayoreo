<?php

declare(strict_types=1);

use App\Actions\Attendance\RotateStoreAttendanceQrAction;
use App\Models\AttendanceLocation;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->manager = User::factory()->create();
    grantApiPermissions($this->manager, 'attendance-qr.manage');
    $this->store = Store::factory()->create([
        'code' => 'LIM-01',
        'name' => 'Tienda Lima',
        'address' => 'Av. Principal 123',
    ]);
});

it('protects the attendance QR web module with its permission', function (): void {
    $unauthorized = User::factory()->create();

    $this->actingAs($unauthorized)
        ->get('/attendance-qr')
        ->assertForbidden();

    $this->actingAs($unauthorized)
        ->post("/attendance-qr/{$this->store->id}/rotate")
        ->assertForbidden();
});

it('shows a stable permanent QR for each active store', function (): void {
    $issued = app(RotateStoreAttendanceQrAction::class)->execute($this->store, $this->manager->id);

    $this->actingAs($this->manager)
        ->get('/attendance-qr')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance-qr/index')
            ->has('stores', 1)
            ->where('stores.0.id', $this->store->id)
            ->where('stores.0.code', 'LIM-01')
            ->where('stores.0.configured', true)
            ->where('stores.0.recoverable', true)
            ->where('stores.0.payload', $issued['payload']));

    $this->actingAs($this->manager)
        ->get('/attendance-qr')
        ->assertInertia(fn (Assert $page) => $page
            ->where('stores.0.payload', $issued['payload'])
            ->etc());
});

it('generates a new QR and invalidates the former one from the web', function (): void {
    $oldPayload = app(RotateStoreAttendanceQrAction::class)
        ->execute($this->store, $this->manager->id)['payload'];

    $this->actingAs($this->manager)
        ->post("/attendance-qr/{$this->store->id}/rotate")
        ->assertRedirect();

    $this->actingAs($this->manager)
        ->get('/attendance-qr')
        ->assertInertia(fn (Assert $page) => $page
            ->where('stores.0.configured', true)
            ->where('stores.0.payload', fn (string $payload): bool => $payload !== $oldPayload
                && str_starts_with($payload, (string) config('payroll.qr_prefix').'v3:'))
            ->etc());
});

it('updates the attendance location and radius from the QR web module', function (): void {
    $this->actingAs($this->manager)
        ->put("/attendance-qr/{$this->store->id}/location", [
            'attendance_latitude' => '-9.9292648',
            'attendance_longitude' => '-76.2399549',
            'attendance_radius_meters' => 75,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('stores', [
        'id' => $this->store->id,
        'attendance_latitude' => '-9.9292648',
        'attendance_longitude' => '-76.2399549',
        'attendance_radius_meters' => 75,
    ]);
    $this->assertDatabaseHas('attendance_locations', [
        'store_id' => $this->store->id,
        'name' => 'Ubicación principal',
        'latitude' => '-9.9292648',
        'longitude' => '-76.2399549',
        'radius_meters' => 75,
        'is_active' => true,
    ]);
});

it('manages several authorized attendance locations for one permanent QR', function (): void {
    foreach ([
        ['name' => 'Local principal', 'latitude' => '-12.0463740', 'longitude' => '-77.0427930', 'radius_meters' => 80],
        ['name' => 'Almacén norte', 'latitude' => '-11.9500000', 'longitude' => '-77.0600000', 'radius_meters' => 120],
        ['name' => 'Punto de reparto', 'latitude' => '-12.1000000', 'longitude' => '-77.0200000', 'radius_meters' => 60],
    ] as $location) {
        $this->actingAs($this->manager)
            ->post("/attendance-qr/{$this->store->id}/locations", [
                ...$location,
                'is_active' => true,
            ])
            ->assertRedirect();
    }

    $warehouse = AttendanceLocation::query()->where('name', 'Almacén norte')->firstOrFail();
    $this->actingAs($this->manager)
        ->put("/attendance-qr/{$this->store->id}/locations/{$warehouse->id}", [
            'name' => 'Almacén norte',
            'latitude' => '-11.9500000',
            'longitude' => '-77.0600000',
            'radius_meters' => 150,
            'is_active' => false,
        ])
        ->assertRedirect();

    expect($this->store->attendanceLocations()->count())->toBe(3)
        ->and($warehouse->fresh()?->radius_meters)->toBe(150)
        ->and($warehouse->fresh()?->is_active)->toBeFalse();

    $this->actingAs($this->manager)
        ->get('/attendance-qr')
        ->assertInertia(fn (Assert $page) => $page
            ->has('stores.0.attendance_locations', 3)
            ->where('stores.0.attendance_locations.2.name', 'Almacén norte')
            ->where('stores.0.attendance_locations.2.is_active', false)
            ->etc());

    $this->actingAs($this->manager)
        ->delete("/attendance-qr/{$this->store->id}/locations/{$warehouse->id}")
        ->assertRedirect();

    $this->assertDatabaseMissing('attendance_locations', ['id' => $warehouse->id]);
});

it('does not allow changing a location that belongs to another store', function (): void {
    $otherLocation = AttendanceLocation::query()->create([
        'store_id' => Store::factory()->create()->id,
        'name' => 'Otra tienda',
        'latitude' => '-12.0463740',
        'longitude' => '-77.0427930',
        'radius_meters' => 100,
        'is_active' => true,
    ]);

    $this->actingAs($this->manager)
        ->put("/attendance-qr/{$this->store->id}/locations/{$otherLocation->id}", [
            'name' => 'Intento inválido',
            'latitude' => '-12.0463740',
            'longitude' => '-77.0427930',
            'radius_meters' => 100,
            'is_active' => true,
        ])
        ->assertNotFound();
});

it('validates attendance coordinates and radius from the web', function (): void {
    $this->actingAs($this->manager)
        ->from('/attendance-qr')
        ->put("/attendance-qr/{$this->store->id}/location", [
            'attendance_latitude' => '-95',
            'attendance_longitude' => '200',
            'attendance_radius_meters' => 10,
        ])
        ->assertRedirect('/attendance-qr')
        ->assertSessionHasErrors([
            'attendance_latitude',
            'attendance_longitude',
            'attendance_radius_meters',
        ]);
});
