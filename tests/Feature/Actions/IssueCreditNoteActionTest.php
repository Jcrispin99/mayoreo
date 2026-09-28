<?php

declare(strict_types=1);

use App\Actions\Sales\IssueCreditNoteAction;
use App\Exceptions\CreditNoteException;
use App\Jobs\SendFiscalDocumentToSunat;
use App\Models\DocumentSeries;
use App\Models\FiscalDocument;
use App\Models\FiscalIssuer;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Queue::fake();

    $this->issuer = FiscalIssuer::factory()->create();
    $this->store = Store::factory()->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'sunat_establishment_code' => '0000',
        'sunat_address' => 'Jr. Prueba 123',
        'sunat_ubigeo' => '100101',
        'sunat_department' => 'HUANUCO',
        'sunat_province' => 'HUANUCO',
        'sunat_district' => 'HUANUCO',
    ]);
    $this->warehouse = Warehouse::factory()->for($this->store)->create();
    $this->product = Product::factory()->create();
    $this->user = User::factory()->create();

    app(StockLedgerService::class)->registerIn(
        $this->product,
        $this->warehouse,
        '10',
        '5.0000',
    );

    $this->sale = Sale::factory()->for($this->warehouse)->create([
        'subtotal' => '20.0000',
        'total' => '20.0000',
        'payable_total' => '20.00',
    ]);
    $this->saleItem = Productable::factory()->create([
        'product_id' => $this->product->id,
        'productable_type' => Sale::class,
        'productable_id' => $this->sale->id,
        'quantity' => '2.000000',
        'input_quantity' => '2.000000',
        'unit_price' => '10.0000',
        'line_total' => '20.0000',
    ]);

    // FC01 is deliberately created first to prove that boletas do not pick it.
    DocumentSeries::factory()->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'credit_note',
        'series_code' => 'FC01',
    ]);
    DocumentSeries::factory()->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'credit_note',
        'series_code' => 'BC01',
    ]);
});

it('uses a B credit-note series when returning a boleta item', function (): void {
    $original = FiscalDocument::factory()->for($this->sale)->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'sunat_status' => 'accepted',
    ]);

    $creditNote = app(IssueCreditNoteAction::class)->execute(
        $original,
        '07',
        null,
        [['sale_item_id' => $this->saleItem->id, 'quantity' => '1']],
        $this->user->id,
    );

    expect($creditNote->series_code)->toBe('BC01')
        ->and($creditNote->number)->toBe(1);
    Queue::assertPushed(SendFiscalDocumentToSunat::class);
});

it('uses an F credit-note series when returning a factura item', function (): void {
    $original = FiscalDocument::factory()->for($this->sale)->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'invoice',
        'series_code' => 'F001',
        'sunat_status' => 'accepted',
    ]);

    $creditNote = app(IssueCreditNoteAction::class)->execute(
        $original,
        '07',
        null,
        [['sale_item_id' => $this->saleItem->id, 'quantity' => '1']],
        $this->user->id,
    );

    expect($creditNote->series_code)->toBe('FC01')
        ->and($creditNote->number)->toBe(1);
});

it('requires every sold quantity for a total return', function (): void {
    $original = FiscalDocument::factory()->for($this->sale)->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'sunat_status' => 'accepted',
    ]);

    expect(fn () => app(IssueCreditNoteAction::class)->execute(
        $original,
        '06',
        null,
        [['sale_item_id' => $this->saleItem->id, 'quantity' => '1']],
        $this->user->id,
    ))->toThrow(
        CreditNoteException::class,
        'La devolución total debe incluir todos los productos con la cantidad completa vendida.',
    );
});

it('rejects non-return credit-note reasons in this stock-return flow', function (): void {
    $original = FiscalDocument::factory()->for($this->sale)->create([
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'sunat_status' => 'accepted',
    ]);

    expect(fn () => app(IssueCreditNoteAction::class)->execute(
        $original,
        '03',
        null,
        [['sale_item_id' => $this->saleItem->id, 'quantity' => '1']],
        $this->user->id,
    ))->toThrow(CreditNoteException::class);
});
