<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

it('shows the web login page to guests', function (): void {
    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/login'));
});

it('redirects guests to login from the web application', function (): void {
    $this->get('/')->assertRedirect('/login');
});

it('authenticates a user through a Laravel web session', function (): void {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
});

it('rejects invalid web credentials', function (): void {
    $user = User::factory()->create();

    $this->from('/login')->post('/login', [
        'email' => $user->email,
        'password' => 'incorrect-password',
    ])->assertRedirect('/login')
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('does not revoke mobile api tokens when logging in on the web', function (): void {
    $user = User::factory()->create();
    $token = $user->createToken('mobile');
    $token->accessToken->forceFill(['device_id' => 'mobile-test-device'])->save();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect('/');

    expect($user->tokens()->count())->toBe(1);
});

it('logs an authenticated web user out', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/logout')
        ->assertRedirect('/login');

    $this->assertGuest();
});
