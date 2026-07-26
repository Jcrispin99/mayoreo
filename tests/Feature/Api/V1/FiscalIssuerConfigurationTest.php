<?php

declare(strict_types=1);

use App\Enums\SunatEnvironment;
use App\Models\DocumentSeries;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use App\Models\Store;
use App\Models\User;
use App\Services\FiscalCertificateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('fiscal-certificates');

    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'stores.view', 'stores.manage');
    $this->headers = [
        'Accept' => 'application/json',
        'Authorization' => 'Bearer '.$this->user->createToken('test-token')->plainTextToken,
    ];
});

/**
 * @return array{pem: string, p12: string, password: string}
 */
function makeFiscalTestCertificate(
    string $commonName = 'Mayoreo Test',
    bool $selfSigned = false,
): array {
    $caPrivateKey = openssl_pkey_new([
        'private_key_bits' => 2048,
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
    ]);

    throw_if($caPrivateKey === false, RuntimeException::class, 'Unable to create the test CA key.');

    $caCsr = openssl_csr_new([
        'countryName' => 'PE',
        'organizationName' => 'Mayoreo Test CA',
        'commonName' => 'Mayoreo Test Root CA',
    ], $caPrivateKey, ['digest_alg' => 'sha256']);

    throw_if($caCsr === false, RuntimeException::class, 'Unable to create the test CA CSR.');

    $caCertificate = openssl_csr_sign(
        $caCsr,
        null,
        $caPrivateKey,
        3650,
        ['digest_alg' => 'sha256'],
    );

    throw_if($caCertificate === false, RuntimeException::class, 'Unable to sign the test CA.');

    $privateKey = openssl_pkey_new([
        'private_key_bits' => 2048,
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
    ]);

    throw_if($privateKey === false, RuntimeException::class, 'Unable to create the test private key.');

    $csr = openssl_csr_new([
        'countryName' => 'PE',
        'organizationName' => 'Mayoreo Test SAC',
        'commonName' => $commonName,
    ], $privateKey, ['digest_alg' => 'sha256']);

    throw_if($csr === false, RuntimeException::class, 'Unable to create the test CSR.');

    $certificate = openssl_csr_sign(
        $csr,
        $selfSigned ? null : $caCertificate,
        $selfSigned ? $privateKey : $caPrivateKey,
        365,
        ['digest_alg' => 'sha256'],
    );

    throw_if($certificate === false, RuntimeException::class, 'Unable to sign the test certificate.');

    $certificatePem = '';
    $privateKeyPem = '';
    $pkcs12 = '';
    $password = 'p12-secret-with-spaces ';

    throw_if(! openssl_x509_export($certificate, $certificatePem)
        || ! openssl_pkey_export($privateKey, $privateKeyPem)
        || ! openssl_pkcs12_export($certificate, $pkcs12, $privateKey, $password)
        || ! is_string($certificatePem)
        || ! is_string($privateKeyPem)
        || ! is_string($pkcs12), RuntimeException::class, 'Unable to export the test certificate.');

    return [
        'pem' => $certificatePem.PHP_EOL.$privateKeyPem,
        'p12' => $pkcs12,
        'password' => $password,
    ];
}

function grantFiscalPermission(User $user, string $permissionName): void
{
    $permission = Permission::query()->firstOrCreate([
        'name' => $permissionName,
        'guard_name' => 'web',
    ]);

    $user->givePermissionTo($permission);
    $user->unsetRelation('permissions')->unsetRelation('roles');
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    Auth::forgetGuards();
}

function createConfiguredFiscalIssuer(): FiscalIssuer
{
    $issuer = FiscalIssuer::factory()->create();
    $issuer->credential()->create([
        'environment' => SunatEnvironment::Beta,
    ]);

    return $issuer;
}

/**
 * @return array<string, string>
 */
function fiscalStoreAddress(string $address = 'Av. Principal 123'): array
{
    return [
        'sunat_address' => $address,
        'sunat_ubigeo' => '150101',
        'sunat_department' => 'Lima',
        'sunat_province' => 'Lima',
        'sunat_district' => 'Lima',
    ];
}

it('protects fiscal configuration with dedicated permissions', function (): void {
    $this->getJson('/api/v1/fiscal-issuers')->assertUnauthorized();

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/fiscal-issuers')
        ->assertForbidden();

    grantFiscalPermission($this->user, 'fiscal-settings.view');

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/fiscal-issuers')
        ->assertOk();

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/fiscal-issuers', [
            'ruc' => '20123456786',
            'legal_name' => 'Mayoreo SAC',
        ])
        ->assertForbidden();
});

it('creates a fiscal issuer with beta credentials separated from stores', function (): void {
    grantFiscalPermission($this->user, 'fiscal-settings.manage');

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/fiscal-issuers', [
            'ruc' => '20123456789',
            'legal_name' => 'RUC inválido SAC',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ruc');

    $response = $this->withHeaders($this->headers)
        ->postJson('/api/v1/fiscal-issuers', [
            'ruc' => '20123456786',
            'legal_name' => 'Mayoreo SAC',
            'trade_name' => 'Mayoreo',
            'fiscal_address' => 'Av. Principal 123',
            'ubigeo' => '150101',
            'department' => 'Lima',
            'province' => 'Lima',
            'district' => 'Lima',
        ])
        ->assertCreated()
        ->assertJsonPath('data.ruc', '20123456786')
        ->assertJsonPath('data.credentials.environment', 'beta')
        ->assertJsonPath('data.credentials.has_sol_credentials', false)
        ->assertJsonPath('data.credentials.has_certificate', false);

    $issuerId = $response->json('data.id');

    $this->assertDatabaseHas('fiscal_issuers', [
        'id' => $issuerId,
        'ruc' => '20123456786',
    ]);
    $this->assertDatabaseHas('fiscal_credentials', [
        'fiscal_issuer_id' => $issuerId,
        'environment' => 'beta',
    ]);
});

it('keeps the RUC immutable after assigning document series', function (): void {
    grantFiscalPermission($this->user, 'fiscal-settings.manage');
    $issuer = createConfiguredFiscalIssuer();
    $otherRuc = FiscalIssuer::factory()->create()->ruc;

    DocumentSeries::factory()
        ->for($issuer, 'fiscalIssuer')
        ->create([
            'document_type' => 'invoice',
            'series_code' => 'F001',
        ]);

    $this->withHeaders($this->headers)
        ->patchJson("/api/v1/fiscal-issuers/{$issuer->id}", [
            'ruc' => $otherRuc,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ruc');

    expect($issuer->fresh()?->ruc)->toBe($issuer->ruc);
});

it('encrypts SOL credentials and never returns their values', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();

    $response = $this->withHeaders($this->headers)
        ->putJson(sprintf('/api/v1/fiscal-issuers/%d/credentials', $issuer->id), [
            'sol_username' => 'FACTURADOR',
            'sol_password' => 'secret-with-trailing-space ',
        ])
        ->assertOk()
        ->assertJsonPath('data.credentials.has_sol_username', true)
        ->assertJsonPath('data.credentials.has_sol_password', true)
        ->assertJsonPath('data.credentials.has_sol_credentials', true);

    $rawCredential = DB::table('fiscal_credentials')
        ->where('fiscal_issuer_id', $issuer->id)
        ->first();

    expect($rawCredential)->not->toBeNull()
        ->and($rawCredential?->sol_username)->not->toBe('FACTURADOR')
        ->and($rawCredential?->sol_password)->not->toBe('secret-with-trailing-space ');

    $credential = FiscalCredential::query()
        ->where('fiscal_issuer_id', $issuer->id)
        ->firstOrFail();

    expect($credential->sol_username)->toBe('FACTURADOR')
        ->and($credential->sol_password)->toBe('secret-with-trailing-space ');

    $resource = $response->json('data.credentials');

    expect($resource)->toBeArray();
    $this->assertArrayNotHasKey('sol_username', $resource);
    $this->assertArrayNotHasKey('sol_password', $resource);
    $this->assertArrayNotHasKey('certificate_path', $resource);
    $this->assertArrayNotHasKey('certificate_disk', $resource);
    $this->assertArrayNotHasKey('sol_username', $credential->toArray());
    $this->assertArrayNotHasKey('sol_password', $credential->toArray());
});

it('imports and encrypts a PEM certificate before storing it', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();
    $bundle = makeFiscalTestCertificate($issuer->ruc);

    $response = $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()
                ->createWithContent('certificate.pem', $bundle['pem']),
        ])
        ->assertOk()
        ->assertJsonPath('data.credentials.has_certificate', true)
        ->assertJsonPath('data.credentials.certificate.source_format', 'pem')
        ->assertJsonPath('data.credentials.certificate.is_self_signed', false)
        ->assertJsonPath('data.credentials.certificate.key_algorithm', 'RSA')
        ->assertJsonPath('data.credentials.certificate.key_size', 2048);

    $credential = $issuer->credential()->firstOrFail();
    $path = $credential->certificate_path;

    expect($path)->not->toBeNull();
    Storage::disk('fiscal-certificates')->assertExists((string) $path);

    $storedContents = Storage::disk('fiscal-certificates')->get((string) $path);

    expect($storedContents)->not->toContain('PRIVATE KEY')
        ->and($storedContents)->not->toContain('BEGIN CERTIFICATE');

    $normalizedPem = resolve(FiscalCertificateService::class)->contents($credential);

    expect($normalizedPem)->toContain('BEGIN CERTIFICATE')
        ->and($normalizedPem)->toContain('PRIVATE KEY');

    $certificateResource = $response->json('data.credentials.certificate');
    expect($certificateResource)->toBeArray();
    $this->assertArrayNotHasKey('path', $certificateResource);
    $this->assertArrayNotHasKey('disk', $certificateResource);
});

it('imports P12 only with the correct passphrase and preserves its spaces', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();
    $bundle = makeFiscalTestCertificate($issuer->ruc);

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()
                ->createWithContent('certificate.p12', $bundle['p12']),
            'certificate_password' => 'incorrect',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('certificate');

    expect($issuer->credential()->firstOrFail()->certificate_path)->toBeNull();

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()
                ->createWithContent('certificate.p12', $bundle['p12']),
            'certificate_password' => $bundle['password'],
        ])
        ->assertOk()
        ->assertJsonPath('data.credentials.certificate.source_format', 'p12');
});

it('keeps the previous certificate when replacement validation fails', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();
    $bundle = makeFiscalTestCertificate('First certificate');

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()
                ->createWithContent('first.pem', $bundle['pem']),
        ])
        ->assertOk();

    $credential = $issuer->credential()->firstOrFail();
    $originalPath = $credential->certificate_path;

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()
                ->createWithContent('invalid.pem', 'not a certificate'),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('certificate');

    expect($issuer->credential()->firstOrFail()->certificate_path)->toBe($originalPath);
    Storage::disk('fiscal-certificates')->assertExists((string) $originalPath);
});

it('rotates the certificate and removes the previous encrypted blob', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();
    $first = makeFiscalTestCertificate('First certificate');
    $second = makeFiscalTestCertificate('Second certificate');

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()->createWithContent('first.pem', $first['pem']),
        ])
        ->assertOk();

    $firstCredential = $issuer->credential()->firstOrFail();
    $firstPath = $firstCredential->certificate_path;
    $firstFingerprint = $firstCredential->certificate_fingerprint_sha256;

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()->createWithContent('second.pem', $second['pem']),
        ])
        ->assertOk();

    $secondCredential = $issuer->credential()->firstOrFail();

    expect($secondCredential->certificate_path)->not->toBe($firstPath)
        ->and($secondCredential->certificate_fingerprint_sha256)->not->toBe($firstFingerprint);
    Storage::disk('fiscal-certificates')->assertMissing((string) $firstPath);
    Storage::disk('fiscal-certificates')->assertExists((string) $secondCredential->certificate_path);
});

it('requires a complete valid setup before activating production', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();

    $this->withHeaders($this->headers)
        ->putJson(sprintf('/api/v1/fiscal-issuers/%d/credentials', $issuer->id), [
            'environment' => 'production',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('environment');

    $this->withHeaders($this->headers)
        ->putJson(sprintf('/api/v1/fiscal-issuers/%d/credentials', $issuer->id), [
            'sol_username' => 'FACTURADOR',
            'sol_password' => 'secret',
        ])
        ->assertOk();

    $selfSignedBundle = makeFiscalTestCertificate($issuer->ruc, true);

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()
                ->createWithContent('self-signed.pem', $selfSignedBundle['pem']),
        ])
        ->assertOk()
        ->assertJsonPath('data.credentials.certificate.is_self_signed', true);

    $this->withHeaders($this->headers)
        ->putJson(sprintf('/api/v1/fiscal-issuers/%d/credentials', $issuer->id), [
            'environment' => 'production',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('environment');

    $bundle = makeFiscalTestCertificate($issuer->ruc);

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()->createWithContent('certificate.pem', $bundle['pem']),
        ])
        ->assertOk();

    $this->withHeaders($this->headers)
        ->putJson(sprintf('/api/v1/fiscal-issuers/%d/credentials', $issuer->id), [
            'environment' => 'production',
        ])
        ->assertOk()
        ->assertJsonPath('data.credentials.environment', 'production')
        ->assertJsonPath('data.configuration_complete', true)
        ->assertJsonPath('data.credentials.certificate.matches_ruc', true);
});

it('deletes the certificate explicitly without clearing SOL credentials', function (): void {
    grantFiscalPermission($this->user, 'fiscal-credentials.manage');
    $issuer = createConfiguredFiscalIssuer();
    $credential = $issuer->credential()->firstOrFail();
    $credential->update([
        'sol_username' => 'FACTURADOR',
        'sol_password' => 'secret',
    ]);
    $bundle = makeFiscalTestCertificate($issuer->ruc);

    $this->withHeaders($this->headers)
        ->post(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id), [
            'certificate' => UploadedFile::fake()->createWithContent('certificate.pem', $bundle['pem']),
        ])
        ->assertOk();

    $this->withHeaders($this->headers)
        ->putJson(sprintf('/api/v1/fiscal-issuers/%d/credentials', $issuer->id), [
            'environment' => 'production',
        ])
        ->assertOk();

    $path = $issuer->credential()->firstOrFail()->certificate_path;

    $this->withHeaders($this->headers)
        ->deleteJson(sprintf('/api/v1/fiscal-issuers/%d/certificate', $issuer->id))
        ->assertOk()
        ->assertJsonPath('data.credentials.environment', 'beta')
        ->assertJsonPath('data.credentials.has_certificate', false)
        ->assertJsonPath('data.credentials.has_sol_credentials', true);

    Storage::disk('fiscal-certificates')->assertMissing((string) $path);
});

it('links multiple stores to one fiscal issuer with their own establishment codes', function (): void {
    grantFiscalPermission($this->user, 'fiscal-settings.manage');
    $issuer = createConfiguredFiscalIssuer();
    $firstStore = Store::factory()->create();
    $secondStore = Store::factory()->create();

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$firstStore->id, [
            'fiscal_issuer_id' => $issuer->id,
            'sunat_establishment_code' => '0000',
            ...fiscalStoreAddress('Av. Tienda Uno 100'),
        ])
        ->assertOk()
        ->assertJsonPath('data.fiscal_issuer_id', $issuer->id)
        ->assertJsonPath('data.sunat_establishment_code', '0000');

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$secondStore->id, [
            'fiscal_issuer_id' => $issuer->id,
            'sunat_establishment_code' => '0001',
            ...fiscalStoreAddress('Av. Tienda Dos 200'),
        ])
        ->assertOk();

    expect($issuer->stores()->count())->toBe(2);
});

it('protects and validates the fiscal assignment of stores', function (): void {
    $issuer = createConfiguredFiscalIssuer();
    $store = Store::factory()->create();

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$store->id, [
            'fiscal_issuer_id' => $issuer->id,
            'sunat_establishment_code' => '0000',
            ...fiscalStoreAddress(),
        ])
        ->assertForbidden();

    grantFiscalPermission($this->user, 'fiscal-settings.manage');

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$store->id, [
            'fiscal_issuer_id' => $issuer->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sunat_establishment_code');

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$store->id, [
            'fiscal_issuer_id' => $issuer->id,
            'sunat_establishment_code' => '0000',
            ...fiscalStoreAddress(),
        ])
        ->assertOk();

    $otherStore = Store::factory()->create();

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$otherStore->id, [
            'fiscal_issuer_id' => $issuer->id,
            'sunat_establishment_code' => '0000',
            ...fiscalStoreAddress('Av. Duplicada 999'),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sunat_establishment_code');

    $this->withHeaders($this->headers)
        ->putJson('/api/v1/stores/'.$store->id, [
            'fiscal_issuer_id' => null,
        ])
        ->assertOk()
        ->assertJsonPath('data.fiscal_issuer_id', null)
        ->assertJsonPath('data.sunat_establishment_code', null)
        ->assertJsonPath('data.sunat_address', null)
        ->assertJsonPath('data.sunat_ubigeo', null);
});
