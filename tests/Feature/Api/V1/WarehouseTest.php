<?php

declare(strict_types=1);

use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'warehouses.view', 'warehouses.manage');
    $this->token = $this->user->createToken('test-token')->plainTextToken;
    $this->store = Store::factory()->create();
});

function authHeader(string $token): array
{
    return ['Authorization' => 'Bearer '.$token];
}

describe('List warehouses', function (): void {
    it('lists all warehouses', function (): void {
        Warehouse::factory()->main()->create();
        Warehouse::factory()->retail()->create();
        Warehouse::factory()->pos()->create();

        $response = $this->withHeaders(authHeader($this->token))
            ->getJson('/api/v1/warehouses');

        $response->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    ['id', 'code', 'name', 'type', 'is_active'],
                ],
            ]);
    });

    it('filters warehouses by type', function (): void {
        Warehouse::factory()->main()->create();
        Warehouse::factory()->retail()->create();

        $response = $this->withHeaders(authHeader($this->token))
            ->getJson('/api/v1/warehouses?type=main');

        $response->assertOk()->assertJsonCount(1, 'data');
        expect($response->json('data.0.type'))->toBe('main');
    });

    it('requires authentication', function (): void {
        $response = $this->getJson('/api/v1/warehouses');

        $response->assertUnauthorized();
    });
});

describe('Create warehouse', function (): void {
    it('creates the 3 fixed-role warehouses', function (): void {
        foreach (['main', 'retail', 'pos'] as $type) {
            $response = $this->withHeaders(authHeader($this->token))
                ->postJson('/api/v1/warehouses', [
                    'store_id' => $this->store->id,
                    'code' => mb_strtoupper($type),
                    'name' => "Almacén {$type}",
                    'type' => $type,
                ]);

            $response->assertCreated()
                ->assertJson([
                    'success' => true,
                    'data' => ['code' => mb_strtoupper($type), 'type' => $type],
                ]);
        }

        $this->assertDatabaseCount('warehouses', 3);
    });

    it('fails with an invalid type', function (): void {
        $response = $this->withHeaders(authHeader($this->token))
            ->postJson('/api/v1/warehouses', [
                'store_id' => $this->store->id,
                'code' => 'BAD',
                'name' => 'Bodega inválida',
                'type' => 'invalid-type',
            ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('type');
    });

    it('fails with a duplicate code', function (): void {
        Warehouse::factory()->create(['code' => 'MAIN']);

        $response = $this->withHeaders(authHeader($this->token))
            ->postJson('/api/v1/warehouses', [
                'store_id' => $this->store->id,
                'code' => 'MAIN',
                'name' => 'Duplicado',
                'type' => 'main',
            ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('code');
    });
});

describe('Show warehouse', function (): void {
    it('shows a single warehouse', function (): void {
        $warehouse = Warehouse::factory()->retail()->create();

        $response = $this->withHeaders(authHeader($this->token))
            ->getJson("/api/v1/warehouses/{$warehouse->id}");

        $response->assertOk()->assertJson([
            'data' => ['id' => $warehouse->id, 'code' => 'RETAIL'],
        ]);
    });

    it('returns 404 for a non-existent warehouse', function (): void {
        $response = $this->withHeaders(authHeader($this->token))
            ->getJson('/api/v1/warehouses/999');

        $response->assertNotFound();
    });
});

describe('Update warehouse', function (): void {
    it('updates a warehouse', function (): void {
        $warehouse = Warehouse::factory()->main()->create();

        $response = $this->withHeaders(authHeader($this->token))
            ->putJson("/api/v1/warehouses/{$warehouse->id}", [
                'name' => 'Nuevo nombre',
                'is_active' => false,
            ]);

        $response->assertOk()->assertJson([
            'data' => ['name' => 'Nuevo nombre', 'is_active' => false],
        ]);

        $this->assertDatabaseHas('warehouses', [
            'id' => $warehouse->id,
            'name' => 'Nuevo nombre',
            'is_active' => false,
        ]);
    });

    it('fails updating to a code already taken by another warehouse', function (): void {
        Warehouse::factory()->create(['code' => 'MAIN']);
        $retail = Warehouse::factory()->create(['code' => 'RETAIL']);

        $response = $this->withHeaders(authHeader($this->token))
            ->putJson("/api/v1/warehouses/{$retail->id}", [
                'code' => 'MAIN',
            ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('code');
    });

    it('changes the default warehouse without leaving two defaults', function (): void {
        $currentDefault = Warehouse::factory()->for($this->store)->create(['is_default' => true]);
        $nextDefault = Warehouse::factory()->for($this->store)->create();

        $this->withHeaders(authHeader($this->token))
            ->putJson("/api/v1/warehouses/{$nextDefault->id}", ['is_default' => true])
            ->assertOk()
            ->assertJsonPath('data.is_default', true);

        expect($currentDefault->refresh()->is_default)->toBeFalse();
    });

    it('does not allow a store to lose its default warehouse', function (): void {
        $warehouse = Warehouse::factory()->for($this->store)->create(['is_default' => true]);

        $this->withHeaders(authHeader($this->token))
            ->putJson("/api/v1/warehouses/{$warehouse->id}", ['is_default' => false])
            ->assertUnprocessable();
    });
});

describe('Delete warehouse', function (): void {
    it('deletes a warehouse', function (): void {
        $warehouse = Warehouse::factory()->create();

        $response = $this->withHeaders(authHeader($this->token))
            ->deleteJson("/api/v1/warehouses/{$warehouse->id}");

        $response->assertNoContent();

        $this->assertDatabaseMissing('warehouses', ['id' => $warehouse->id]);
    });
});
