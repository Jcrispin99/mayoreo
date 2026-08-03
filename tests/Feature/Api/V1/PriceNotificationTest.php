<?php

declare(strict_types=1);

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\PushSubscription;
use App\Models\UnitOfMeasure;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->actor = User::factory()->create(['name' => 'Administrador']);
    grantApiPermissions($this->actor, 'products.manage', 'products.view');
    $this->recipient = User::factory()->create(['name' => 'Vendedora']);
    grantApiPermissions($this->recipient, 'price-notifications.receive');
    $this->otherUser = User::factory()->create();

    $grams = UnitOfMeasure::factory()->grams()->create();
    $this->product = Product::factory()->create([
        'name' => 'Arroz Extra',
        'base_unit_id' => $grams->id,
    ]);
    $this->tier = PriceTier::factory()->for($this->product)->create([
        'label' => 'Precio Kilo',
        'min_quantity' => 1000,
        'max_quantity' => null,
        'unit_price' => '0.0050',
        'is_active' => true,
    ]);

    $this->headers = [
        'Authorization' => 'Bearer '.$this->actor->createToken('price-test')->plainTextToken,
    ];
});

it('notifies sales staff and highlights the product when a price changes', function (): void {
    $this->withHeaders($this->headers)
        ->patchJson("/api/v1/price-tiers/{$this->tier->id}", [
            'unit_price' => '0.0055',
        ])
        ->assertOk();

    $notification = $this->recipient->notifications()->first();

    expect($notification)->not->toBeNull()
        ->and($notification?->data['kind'])->toBe('price_change')
        ->and($notification?->data['product_name'])->toContain('Arroz Extra')
        ->and($notification?->data['old_price'])->toBe('5.00')
        ->and($notification?->data['new_price'])->toBe('5.50')
        ->and($notification?->data['price_unit'])->toBe('kg')
        ->and($notification?->data['direction'])->toBe('increased')
        ->and($this->otherUser->notifications()->count())->toBe(0);

    $this->product->refresh();
    expect($this->product->price_changed_at)->not->toBeNull()
        ->and($this->product->price_highlight_until?->isFuture())->toBeTrue();
});

it('lists and marks only the authenticated users notification as read', function (): void {
    $this->withHeaders($this->headers)
        ->patchJson("/api/v1/price-tiers/{$this->tier->id}", ['unit_price' => '0.0048'])
        ->assertOk();

    $notificationId = (string) $this->recipient->notifications()->value('id');
    expect($this->recipient->unreadNotifications()->count())->toBe(1);
    $this->actingAs($this->recipient, 'sanctum');

    $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('data.unread_count', 1)
        ->assertJsonPath('data.items.0.data.new_price', '4.80');

    $this->patchJson("/api/v1/notifications/{$notificationId}/read")
        ->assertOk()
        ->assertJsonPath('data.id', $notificationId);

    expect($this->recipient->unreadNotifications()->count())->toBe(0);
});

it('does not alert when only the descriptive label changes', function (): void {
    $this->withHeaders($this->headers)
        ->patchJson("/api/v1/price-tiers/{$this->tier->id}", ['label' => 'Kilo regular'])
        ->assertOk();

    expect($this->recipient->notifications()->count())->toBe(0);
});

it('registers and disables the current users Expo push token', function (): void {
    $recipientHeaders = [
        'Authorization' => 'Bearer '.$this->recipient->createToken('seller-device')->plainTextToken,
    ];
    $expoToken = 'ExponentPushToken[price-test-device]';

    $this->withHeaders($recipientHeaders)->postJson('/api/v1/push-subscriptions', [
        'expo_push_token' => $expoToken,
        'platform' => 'android',
    ])->assertOk()->assertJsonPath('data.registered', true);

    $this->assertDatabaseHas('push_subscriptions', [
        'user_id' => $this->recipient->id,
        'expo_push_token' => $expoToken,
        'is_active' => true,
    ]);

    $this->withHeaders($recipientHeaders)->deleteJson('/api/v1/push-subscriptions/current', [
        'expo_push_token' => $expoToken,
    ])->assertNoContent();

    expect(PushSubscription::query()->where('expo_push_token', $expoToken)->value('is_active'))->toBeFalse();
});
