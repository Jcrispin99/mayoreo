<?php

declare(strict_types=1);

use App\Contracts\SunatBillSender;
use App\Data\SunatTransmissionResult;
use App\Models\FiscalDocument;
use App\Models\FiscalIssuer;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('fiscal-documents');
    $user = User::factory()->create();
    grantApiPermissions($user, 'sales.manage');
    $this->headers = [
        'Authorization' => 'Bearer '.$user->createToken('sunat-test')->plainTextToken,
    ];

    $issuer = FiscalIssuer::factory()->create(['ruc' => '20000000001']);
    $store = Store::factory()->for($issuer, 'fiscalIssuer')->create();
    $sale = Sale::factory()
        ->for(Warehouse::factory()->for($store))
        ->create();
    $this->document = FiscalDocument::factory()->for($sale)->create([
        'fiscal_issuer_id' => $issuer->id,
        'store_id' => $store->id,
        'issuer_ruc' => '20000000001',
        'issuer_legal_name' => 'EMPRESA BETA SAC',
        'issuer_trade_name' => 'EMPRESA BETA',
        'establishment_code' => '0000',
        'establishment_address' => 'AV. PRUEBA 123',
        'establishment_ubigeo' => '150101',
        'establishment_urbanization' => '-',
        'establishment_department' => 'LIMA',
        'establishment_province' => 'LIMA',
        'establishment_district' => 'LIMA',
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'number' => 1,
    ]);
});

it('stores the signed XML and accepted CDR without sending twice', function (): void {
    $sender = new class implements SunatBillSender
    {
        public int $calls = 0;

        public function send(FiscalDocument $document): SunatTransmissionResult
        {
            $this->calls++;

            return new SunatTransmissionResult(
                xml: '<Invoice signed="true"/>',
                cdrZip: 'cdr-zip',
                status: 'accepted',
                cdrCode: '0',
                cdrDescription: 'La Boleta numero B001-1 ha sido aceptada',
            );
        }
    };
    app()->instance(SunatBillSender::class, $sender);

    $endpoint = "/api/v1/fiscal-documents/{$this->document->id}/send";

    $this->withHeaders($this->headers)
        ->postJson($endpoint)
        ->assertOk()
        ->assertJsonPath('data.sunat.status', 'accepted')
        ->assertJsonPath('data.sunat.cdr_code', '0')
        ->assertJsonPath('data.sunat.has_xml', true)
        ->assertJsonPath('data.sunat.has_cdr', true);

    $this->withHeaders($this->headers)
        ->postJson($endpoint)
        ->assertOk()
        ->assertJsonPath('data.sunat.status', 'accepted');

    $document = $this->document->refresh();
    expect($sender->calls)->toBe(1)
        ->and($document->sunat_attempts)->toBe(1)
        ->and($document->xml_hash)->toBe(hash('sha256', '<Invoice signed="true"/>'));
    Storage::disk('fiscal-documents')->assertExists((string) $document->xml_path);
    Storage::disk('fiscal-documents')->assertExists((string) $document->cdr_path);
});

it('rejects internal sales tickets because they are not electronic bills', function (): void {
    $this->document->update(['document_type' => 'sales_ticket']);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/fiscal-documents/{$this->document->id}/send")
        ->assertUnprocessable()
        ->assertJsonPath('success', false);
});
