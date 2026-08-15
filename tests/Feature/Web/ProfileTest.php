<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

it('requires authentication to administer a profile', function (): void {
    $this->get('/profile')->assertRedirect('/login');
    $this->patch('/profile')->assertRedirect('/login');
    $this->put('/profile/password')->assertRedirect('/login');
});

it('shows the profile page to the authenticated user', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/profile')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('profile/edit')
            ->where('auth.user.id', $user->id)
            ->where('auth.user.email', $user->email));
});

it('updates the authenticated users profile', function (): void {
    Notification::fake();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', [
            'name' => 'Nuevo Nombre',
            'email' => 'nuevo@example.com',
        ])
        ->assertRedirect();

    $user->refresh();

    expect($user->name)->toBe('Nuevo Nombre')
        ->and($user->email)->toBe('nuevo@example.com')
        ->and($user->email_verified_at)->toBeNull();

    Notification::assertSentTo($user, VerifyEmail::class);
});

it('preserves email verification when the email does not change', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/profile', [
            'name' => 'Nombre Actualizado',
            'email' => $user->email,
        ])
        ->assertRedirect();

    expect($user->fresh()->email_verified_at)->not->toBeNull();
});

it('does not allow using another users email', function (): void {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $this->actingAs($user)
        ->from('/profile')
        ->patch('/profile', [
            'name' => $user->name,
            'email' => $otherUser->email,
        ])
        ->assertRedirect('/profile')
        ->assertSessionHasErrors('email');
});

it('updates the password when the current password is correct', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put('/profile/password', [
            'current_password' => 'password',
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ])
        ->assertRedirect();

    expect(Hash::check('new-secure-password', $user->fresh()->password))->toBeTrue();
    $this->assertAuthenticatedAs($user);
});

it('rejects an incorrect current password', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/profile')
        ->put('/profile/password', [
            'current_password' => 'incorrect-password',
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ])
        ->assertRedirect('/profile')
        ->assertSessionHasErrors('current_password');

    expect(Hash::check('password', $user->fresh()->password))->toBeTrue();
});
