<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\DeviceSessionService;
use Database\Seeders\MultipleDevicePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

describe('Registration', function (): void {
    it('registers a new user successfully', function (): void {
        $response = $this->postJson('/api/v1/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'device_id' => 'device-registration-1',
            'device_name' => 'iPhone de prueba',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => ['id', 'name', 'email'],
                    'token',
                ],
            ])
            ->assertJson([
                'success' => true,
                'message' => 'User registered successfully. Please check your email to verify your account.',
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
        ]);
    });

    it('fails registration with invalid data', function (): void {
        $response = $this->postJson('/api/v1/register', [
            'name' => '',
            'email' => 'invalid-email',
            'password' => 'short',
        ]);

        $response->assertStatus(422);
    });

    it('fails registration with duplicate email', function (): void {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/v1/register', [
            'name' => 'Test User',
            'email' => 'existing@example.com',
            'password' => 'password123',
            'device_id' => 'device-login-1',
            'device_name' => 'Android de prueba',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422);
    });
});

describe('Login', function (): void {
    it('logs in with valid credentials', function (): void {
        $user = User::factory()->create([
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'password123',
            'device_id' => 'device-login-1',
            'device_name' => 'Android de prueba',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => ['id', 'name', 'email'],
                    'token',
                ],
            ])
            ->assertJson([
                'success' => true,
                'message' => 'Login successful',
            ]);
    });

    it('fails login with invalid credentials', function (): void {
        $user = User::factory()->create([
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'wrongpassword',
            'device_id' => 'device-login-1',
            'device_name' => 'Android de prueba',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid credentials',
            ]);
    });

    it('fails login with non-existent user', function (): void {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'nonexistent@example.com',
            'password' => 'password123',
            'device_id' => 'device-login-1',
            'device_name' => 'Android de prueba',
        ]);

        $response->assertStatus(401);
    });

    it('renews the session on the same device for an ordinary user', function (): void {
        $user = User::factory()->create(['password' => bcrypt('password123')]);
        $payload = [
            'email' => $user->email,
            'password' => 'password123',
            'device_id' => 'cashier-phone-1',
            'device_name' => 'Teléfono de caja',
        ];

        $firstToken = $this->postJson('/api/v1/login', $payload)->assertOk()->json('data.token');
        $secondToken = $this->postJson('/api/v1/login', $payload)->assertOk()->json('data.token');

        expect($secondToken)->not->toBe($firstToken)
            ->and($user->tokens()->count())->toBe(1)
            ->and($user->tokens()->value('device_id'))->toBe('cashier-phone-1');
    });

    it('rejects a second device for an ordinary user', function (): void {
        $user = User::factory()->create(['password' => bcrypt('password123')]);

        $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'password123',
            'device_id' => 'cashier-phone-1',
            'device_name' => 'Primer teléfono',
        ])->assertOk();

        $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'password123',
            'device_id' => 'cashier-phone-2',
            'device_name' => 'Segundo teléfono',
        ])->assertStatus(409)
            ->assertJson([
                'success' => false,
                'message' => 'La cuenta ya tiene otro dispositivo vinculado.',
            ]);

        expect($user->tokens()->count())->toBe(1)
            ->and($user->tokens()->value('device_id'))->toBe('cashier-phone-1');
    });

    it('allows multiple devices when the user has permission', function (): void {
        $user = User::factory()->create(['password' => bcrypt('password123')]);
        grantApiPermissions($user, DeviceSessionService::MULTIPLE_DEVICES_PERMISSION);

        foreach (['admin-phone-1', 'admin-tablet-1'] as $deviceId) {
            $this->postJson('/api/v1/login', [
                'email' => $user->email,
                'password' => 'password123',
                'device_id' => $deviceId,
                'device_name' => $deviceId,
            ])->assertOk();
        }

        expect($user->tokens()->pluck('device_id')->sort()->values()->all())->toBe([
            'admin-phone-1',
            'admin-tablet-1',
        ]);
    });

    it('grants the multiple-device permission to the admin role through its seeder', function (): void {
        Role::findOrCreate('admin', 'web');

        $this->seed(MultipleDevicePermissionSeeder::class);

        expect(Role::findByName('admin', 'web')->hasPermissionTo(
            DeviceSessionService::MULTIPLE_DEVICES_PERMISSION,
        ))->toBeTrue();
    });
});

describe('Logout', function (): void {
    it('logs out authenticated user', function (): void {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logged out successfully',
            ]);
    });

    it('fails logout without authentication', function (): void {
        $response = $this->postJson('/api/v1/logout');

        $response->assertStatus(401);
    });
});

describe('Me', function (): void {
    it('returns authenticated user data', function (): void {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/me');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => ['id', 'name', 'email', 'permissions'],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'email' => $user->email,
                ],
            ]);
    });

    it('returns the effective permissions granted through roles', function (): void {
        $user = User::factory()->create();
        grantApiPermissions($user, 'users.view', 'stores.view');
        $token = $user->createToken('test-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.permissions', ['stores.view', 'users.view']);
    });

    it('fails without authentication', function (): void {
        $response = $this->getJson('/api/v1/me');

        $response->assertStatus(401);
    });
});
