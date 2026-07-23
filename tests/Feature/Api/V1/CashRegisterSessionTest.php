<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\DocumentSeries;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$this->user->createToken('cash-session-test')->plainTextToken];
    $store = Store::factory()->create();
    $warehouse = Warehouse::factory()->for($store)->pos()->create();
    $series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'NV99',
    ]);
    $this->cashRegister = CashRegister::query()->create([
        'store_id' => $store->id,
        'warehouse_id' => $warehouse->id,
        'default_sales_series_id' => $series->id,
        'code' => 'CAJA-TEST',
        'name' => 'Caja de prueba',
        'is_active' => true,
    ]);
    $this->cashRegister->salesSeries()->attach($series);
});

function openCashSession(object $test, string $openingAmount = '100.00'): array
{
    return $test->withHeaders($test->headers)
        ->postJson("/api/v1/cash-registers/{$test->cashRegister->id}/sessions", [
            'opening_amount' => $openingAmount,
            'opening_notes' => 'Fondo inicial',
        ])
        ->assertCreated()
        ->json('data');
}

it('opens a cash register and prevents a second active opening', function (): void {
    $session = openCashSession($this);

    expect($session['status'])->toBe('open')
        ->and($session['opening_amount'])->toBe('100.00')
        ->and($session['expected_amount'])->toBe('100.00')
        ->and($session['opener']['id'])->toBe($this->user->id);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-registers/{$this->cashRegister->id}/sessions", [
            'opening_amount' => '25.00',
        ])
        ->assertUnprocessable();

    $this->assertDatabaseCount('cash_register_sessions', 1);
});

it('registers income and expense movements and updates expected cash', function (): void {
    $session = openCashSession($this);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/movements", [
            'type' => 'income',
            'amount' => '40.50',
            'reason' => 'Fondo adicional',
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'income');

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/movements", [
            'type' => 'expense',
            'amount' => '15.25',
            'reason' => 'Compra de útiles',
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'expense');

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$session['id']}")
        ->assertOk()
        ->assertJsonPath('data.income_total', '40.50')
        ->assertJsonPath('data.expense_total', '15.25')
        ->assertJsonPath('data.expected_amount', '125.25')
        ->assertJsonCount(2, 'data.movements');
});

it('closes the session and calculates the counted difference', function (): void {
    $session = openCashSession($this);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/movements", [
            'type' => 'income',
            'amount' => '20.00',
            'reason' => 'Ingreso manual',
        ])
        ->assertCreated();

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/close", [
            'counted_amount' => '118.50',
            'closing_notes' => 'Faltante revisado',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.expected_amount', '120.00')
        ->assertJsonPath('data.counted_amount', '118.50')
        ->assertJsonPath('data.difference_amount', '-1.50')
        ->assertJsonPath('data.closer.id', $this->user->id);
});

it('rejects movements and another close after the session is closed', function (): void {
    $session = openCashSession($this);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/close", [
            'counted_amount' => '100.00',
        ])
        ->assertOk();

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/movements", [
            'type' => 'income',
            'amount' => '1.00',
            'reason' => 'Movimiento tardío',
        ])
        ->assertUnprocessable();

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$session['id']}/close", [
            'counted_amount' => '100.00',
        ])
        ->assertUnprocessable();
});

it('rejects opening an inactive cash register and invalid amounts', function (): void {
    $this->cashRegister->update(['is_active' => false]);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-registers/{$this->cashRegister->id}/sessions", [
            'opening_amount' => '10.00',
        ])
        ->assertUnprocessable();

    $this->cashRegister->update(['is_active' => true]);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-registers/{$this->cashRegister->id}/sessions", [
            'opening_amount' => '-1.00',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('opening_amount');
});

it('requires authentication', function (): void {
    $this->getJson('/api/v1/cash-register-sessions')->assertUnauthorized();
});
