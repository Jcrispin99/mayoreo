<?php

declare(strict_types=1);

use App\Actions\Attendance\RotateStoreAttendanceQrAction;
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
