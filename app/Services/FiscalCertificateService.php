<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\SunatEnvironment;
use App\Exceptions\FiscalCertificateUnavailableException;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;
use OpenSSLAsymmetricKey;
use OpenSSLCertificate;
use RuntimeException;
use SensitiveParameter;
use Throwable;

final class FiscalCertificateService
{
    public function __construct(
        private readonly FiscalCertificateCleanupService $cleanupService,
    ) {}

    /**
     * @throws ValidationException
     */
    public function replace(
        FiscalIssuer $fiscalIssuer,
        UploadedFile $certificateFile,
        #[SensitiveParameter]
        ?string $password,
        int $uploadedByUserId,
    ): FiscalCredential {
        $certificate = $this->inspectAndNormalize(
            $certificateFile,
            $password,
            $fiscalIssuer->ruc,
        );
        $diskName = $this->certificateDisk();
        $path = $fiscalIssuer->id.'/'.Str::uuid()->toString().'.pem.enc';
        $encryptedContents = Crypt::encryptString($certificate['pem']);

        $this->cleanupService->stage($diskName, $path, $fiscalIssuer->id);

        try {
            $disk = Storage::disk($diskName);

            throw_unless($disk->put($path, $encryptedContents, ['visibility' => 'private']), RuntimeException::class, 'No se pudo almacenar el certificado fiscal.');

            $storedContents = $disk->get($path);

            throw_if(! is_string($storedContents)
                || ! hash_equals($certificate['pem'], Crypt::decryptString($storedContents)), RuntimeException::class, 'No se pudo verificar el certificado fiscal almacenado.');
        } catch (Throwable $throwable) {
            $this->cleanupService->processNow($diskName, $path);

            throw $throwable;
        }

        try {
            $previousFile = DB::transaction(function () use (
                $fiscalIssuer,
                $uploadedByUserId,
                $diskName,
                $path,
                $certificate,
            ): array {
                $currentIssuer = FiscalIssuer::query()
                    ->whereKey($fiscalIssuer->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($currentIssuer->ruc !== $fiscalIssuer->ruc) {
                    throw ValidationException::withMessages([
                        'certificate' => [
                            'El RUC del emisor cambió durante la carga. Vuelva a cargar el certificado.',
                        ],
                    ]);
                }

                $credential = FiscalCredential::query()
                    ->where('fiscal_issuer_id', $fiscalIssuer->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $this->cleanupService->lockStaged($diskName, $path);

                $previousFile = [
                    'disk' => $credential->certificate_disk,
                    'path' => $credential->certificate_path,
                ];

                if ($credential->environment === SunatEnvironment::Production
                    && (! $certificate['matches_ruc'] || $certificate['is_self_signed'])) {
                    throw ValidationException::withMessages([
                        'certificate' => [
                            'En producción, el certificado debe corresponder al RUC y no puede ser autofirmado.',
                        ],
                    ]);
                }

                if (is_string($previousFile['disk'])
                    && $previousFile['disk'] !== ''
                    && is_string($previousFile['path'])
                    && $previousFile['path'] !== '') {
                    $this->cleanupService->enqueue(
                        $previousFile['disk'],
                        $previousFile['path'],
                        $fiscalIssuer->id,
                        'rotation',
                    );
                }

                $credential->forceFill([
                    'certificate_disk' => $diskName,
                    'certificate_path' => $path,
                    'certificate_original_name' => $certificate['original_name'],
                    'certificate_source_format' => $certificate['source_format'],
                    'certificate_fingerprint_sha256' => $certificate['fingerprint_sha256'],
                    'certificate_matches_ruc' => $certificate['matches_ruc'],
                    'certificate_is_self_signed' => $certificate['is_self_signed'],
                    'certificate_key_algorithm' => $certificate['key_algorithm'],
                    'certificate_key_size' => $certificate['key_size'],
                    'certificate_serial_number' => $certificate['serial_number'],
                    'certificate_subject' => $certificate['subject'],
                    'certificate_issuer' => $certificate['issuer'],
                    'certificate_size_bytes' => $certificate['size_bytes'],
                    'certificate_valid_from' => $certificate['valid_from'],
                    'certificate_expires_at' => $certificate['expires_at'],
                    'certificate_uploaded_at' => now(),
                    'certificate_uploaded_by_user_id' => $uploadedByUserId,
                    'updated_by_user_id' => $uploadedByUserId,
                ])->save();

                $this->cleanupService->cancel($diskName, $path);

                return $previousFile;
            });
        } catch (Throwable $throwable) {
            $this->cleanupService->processNow($diskName, $path);

            throw $throwable;
        }

        if (is_string($previousFile['disk'])
            && $previousFile['disk'] !== ''
            && is_string($previousFile['path'])
            && $previousFile['path'] !== '') {
            $this->cleanupService->processNow(
                $previousFile['disk'],
                $previousFile['path'],
            );
        }

        return FiscalCredential::query()
            ->where('fiscal_issuer_id', $fiscalIssuer->id)
            ->firstOrFail();
    }

    public function remove(FiscalIssuer $fiscalIssuer, int $updatedByUserId): FiscalCredential
    {
        $previousFile = DB::transaction(function () use ($fiscalIssuer, $updatedByUserId): array {
            FiscalIssuer::query()
                ->whereKey($fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $credential = FiscalCredential::query()
                ->where('fiscal_issuer_id', $fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $previousFile = [
                'disk' => $credential->certificate_disk,
                'path' => $credential->certificate_path,
            ];

            if (is_string($previousFile['disk'])
                && $previousFile['disk'] !== ''
                && is_string($previousFile['path'])
                && $previousFile['path'] !== '') {
                $this->cleanupService->enqueue(
                    $previousFile['disk'],
                    $previousFile['path'],
                    $fiscalIssuer->id,
                    'revocation',
                );
            }

            $credential->forceFill([
                'certificate_disk' => null,
                'certificate_path' => null,
                'certificate_original_name' => null,
                'certificate_source_format' => null,
                'certificate_fingerprint_sha256' => null,
                'certificate_matches_ruc' => null,
                'certificate_is_self_signed' => null,
                'certificate_key_algorithm' => null,
                'certificate_key_size' => null,
                'certificate_serial_number' => null,
                'certificate_subject' => null,
                'certificate_issuer' => null,
                'certificate_size_bytes' => null,
                'certificate_valid_from' => null,
                'certificate_expires_at' => null,
                'certificate_uploaded_at' => null,
                'certificate_uploaded_by_user_id' => null,
                'environment' => SunatEnvironment::Beta,
                'updated_by_user_id' => $updatedByUserId,
            ])->save();

            return $previousFile;
        });

        if (is_string($previousFile['disk'])
            && $previousFile['disk'] !== ''
            && is_string($previousFile['path'])
            && $previousFile['path'] !== '') {
            $this->cleanupService->processNow(
                $previousFile['disk'],
                $previousFile['path'],
            );
        }

        return FiscalCredential::query()
            ->where('fiscal_issuer_id', $fiscalIssuer->id)
            ->firstOrFail();
    }

    /**
     * This will be consumed by the Greenter adapter in the next stage.
     */
    public function contents(FiscalCredential $credential): string
    {
        return DB::transaction(function () use ($credential): string {
            $currentCredential = FiscalCredential::query()
                ->whereKey($credential->id)
                ->lockForUpdate()
                ->firstOrFail();

            return $this->decryptAndValidate($currentCredential);
        });
    }

    private function decryptAndValidate(FiscalCredential $credential): string
    {
        throw_unless($credential->hasCertificate(), LogicException::class, 'El emisor no tiene un certificado fiscal configurado.');

        if ($credential->environment === SunatEnvironment::Production) {
            $fiscalIssuer = $credential->fiscalIssuer()->first();

            throw_if(
                ! $fiscalIssuer instanceof FiscalIssuer
                    || ! $fiscalIssuer->is_active
                    || ! $credential->certificateMeetsProductionRequirements(),
                FiscalCertificateUnavailableException::class,
                'La configuración del certificado de producción no es válida.',
            );
        }

        $diskName = $credential->certificate_disk;
        $path = $credential->certificate_path;

        throw_if($diskName === null || $path === null, LogicException::class, 'La referencia del certificado fiscal está incompleta.');

        try {
            $encryptedContents = Storage::disk($diskName)->get($path);
            throw_unless(is_string($encryptedContents), FiscalCertificateUnavailableException::class, 'No se pudo leer el certificado fiscal.');
            $pem = Crypt::decryptString($encryptedContents);
        } catch (FiscalCertificateUnavailableException $exception) {
            throw $exception;
        } catch (Throwable $throwable) {
            throw new FiscalCertificateUnavailableException(
                'No se pudo leer o descifrar el certificado fiscal.',
                previous: $throwable,
            );
        }

        $certificate = @openssl_x509_read($pem);

        throw_if($certificate === false || $credential->certificate_fingerprint_sha256 === null, FiscalCertificateUnavailableException::class, 'El certificado fiscal almacenado no es válido.');

        $fingerprint = openssl_x509_fingerprint($certificate, 'sha256');

        throw_if($fingerprint === false
            || ! hash_equals(
                $credential->certificate_fingerprint_sha256,
                Str::lower(str_replace(':', '', $fingerprint))
            ), FiscalCertificateUnavailableException::class, 'La integridad del certificado fiscal no pudo verificarse.');

        throw_unless($credential->certificateIsCurrentlyValid(), FiscalCertificateUnavailableException::class, 'El certificado fiscal no está vigente.');

        return $pem;
    }

    /**
     * @return array{
     *     pem: string,
     *     original_name: string,
     *     source_format: string,
     *     fingerprint_sha256: string,
     *     matches_ruc: bool,
     *     is_self_signed: bool,
     *     key_algorithm: string,
     *     key_size: int,
     *     serial_number: string|null,
     *     subject: string|null,
     *     issuer: string|null,
     *     size_bytes: int,
     *     valid_from: CarbonImmutable,
     *     expires_at: CarbonImmutable
     * }
     *
     * @throws ValidationException
     */
    private function inspectAndNormalize(
        UploadedFile $file,
        #[SensitiveParameter]
        ?string $password,
        string $expectedRuc,
    ): array {
        $sourceFormat = Str::lower($file->getClientOriginalExtension());

        if (! in_array($sourceFormat, ['pem', 'pfx', 'p12', 'txt'], true)) {
            $this->invalidCertificate('El certificado debe ser un archivo PEM, PFX o P12.');
        }

        $contents = $file->getContent();

        if ($contents === '') {
            $this->invalidCertificate('El archivo del certificado está vacío.');
        }

        [$certificate, $privateKey] = in_array($sourceFormat, ['pfx', 'p12'], true)
            ? $this->readPkcs12($contents, $password)
            : $this->readPem($contents, $password);

        if (! openssl_x509_check_private_key($certificate, $privateKey)) {
            $this->invalidCertificate('La clave privada no corresponde al certificado digital.');
        }

        $certificatePem = '';
        $privateKeyPem = '';

        if (! openssl_x509_export($certificate, $certificatePem)
            || ! openssl_pkey_export($privateKey, $privateKeyPem)
            || ! is_string($certificatePem)
            || ! is_string($privateKeyPem)) {
            $this->invalidCertificate('No se pudo normalizar el certificado digital a formato PEM.');
        }

        $details = openssl_x509_parse($certificate, false);

        if ($details === false) {
            $this->invalidCertificate('No se pudieron leer los metadatos del certificado digital.');
        }

        /** @var array<string, mixed> $details */
        $validFromTimestamp = $this->timestampFrom($details, 'validFrom_time_t');
        $expiresAtTimestamp = $this->timestampFrom($details, 'validTo_time_t');
        $validFrom = CarbonImmutable::createFromTimestampUTC($validFromTimestamp);
        $expiresAt = CarbonImmutable::createFromTimestampUTC($expiresAtTimestamp);
        $now = CarbonImmutable::now('UTC');

        if ($expiresAt->lessThanOrEqualTo($now)) {
            $this->invalidCertificate('El certificado digital está vencido.');
        }

        if ($validFrom->greaterThan($now)) {
            $this->invalidCertificate('El certificado digital todavía no está vigente.');
        }

        $fingerprint = openssl_x509_fingerprint($certificate, 'sha256');

        if ($fingerprint === false) {
            $this->invalidCertificate('No se pudo calcular la huella del certificado digital.');
        }

        $serialNumber = $details['serialNumberHex'] ?? $details['serialNumber'] ?? null;
        $publicKey = openssl_pkey_get_public($certificate);
        $keyDetails = openssl_pkey_get_details($privateKey);

        if ($publicKey === false || $keyDetails === false) {
            $this->invalidCertificate('No se pudieron leer las claves del certificado digital.');
        }

        $keyType = $keyDetails['type'] ?? null;
        $keySize = $keyDetails['bits'] ?? null;

        if ($keyType !== OPENSSL_KEYTYPE_RSA || ! is_int($keySize) || $keySize < 2048) {
            $this->invalidCertificate('El certificado debe usar una clave RSA de al menos 2048 bits.');
        }

        return [
            'pem' => mb_trim($certificatePem).PHP_EOL.mb_trim($privateKeyPem).PHP_EOL,
            'original_name' => Str::limit($file->getClientOriginalName(), 255, ''),
            'source_format' => $sourceFormat === 'txt' ? 'pem' : $sourceFormat,
            'fingerprint_sha256' => Str::lower(str_replace(':', '', $fingerprint)),
            'matches_ruc' => $this->distinguishedNameContainsRuc(
                $details['subject'] ?? null,
                $expectedRuc,
            ),
            'is_self_signed' => openssl_x509_verify($certificate, $publicKey) === 1,
            'key_algorithm' => 'RSA',
            'key_size' => $keySize,
            'serial_number' => is_scalar($serialNumber) ? (string) $serialNumber : null,
            'subject' => $this->distinguishedName($details['subject'] ?? null),
            'issuer' => $this->distinguishedName($details['issuer'] ?? null),
            'size_bytes' => mb_strlen($contents, '8bit'),
            'valid_from' => $validFrom,
            'expires_at' => $expiresAt,
        ];
    }

    /**
     * @return array{OpenSSLCertificate, OpenSSLAsymmetricKey}
     *
     * @throws ValidationException
     */
    private function readPem(
        #[SensitiveParameter]
        string $contents,
        #[SensitiveParameter]
        ?string $password,
    ): array {
        $certificate = @openssl_x509_read($contents);
        $privateKey = @openssl_pkey_get_private($contents, $password ?? '');

        if ($certificate === false || $privateKey === false) {
            $this->invalidCertificate(
                'El PEM debe contener un certificado y su clave privada válida.'
            );
        }

        return [$certificate, $privateKey];
    }

    /**
     * @return array{OpenSSLCertificate, OpenSSLAsymmetricKey}
     *
     * @throws ValidationException
     */
    private function readPkcs12(
        #[SensitiveParameter]
        string $contents,
        #[SensitiveParameter]
        ?string $password,
    ): array {
        /** @var array<string, mixed> $bundle */
        $bundle = [];

        if (! @openssl_pkcs12_read($contents, $bundle, $password ?? '')) {
            $this->invalidCertificate(
                'No se pudo abrir el PFX/P12. Verifique la contraseña del certificado.'
            );
        }

        if (! is_array($bundle)) {
            $this->invalidCertificate('El contenido del PFX/P12 no es válido.');
        }

        /** @var array<string, mixed> $bundle */
        $certificateContents = $bundle['cert'] ?? null;
        $privateKeyContents = $bundle['pkey'] ?? null;

        if (! is_string($certificateContents) || ! is_string($privateKeyContents)) {
            $this->invalidCertificate('El PFX/P12 no contiene certificado y clave privada.');
        }

        $certificate = @openssl_x509_read($certificateContents);
        $privateKey = @openssl_pkey_get_private($privateKeyContents);

        if ($certificate === false || $privateKey === false) {
            $this->invalidCertificate('El contenido del PFX/P12 no es válido.');
        }

        return [$certificate, $privateKey];
    }

    /**
     * @param  array<string, mixed>  $details
     *
     * @throws ValidationException
     */
    private function timestampFrom(array $details, string $key): int
    {
        $value = $details[$key] ?? null;

        if (! is_int($value) && ! is_numeric($value)) {
            $this->invalidCertificate('El certificado no contiene un periodo de vigencia válido.');
        }

        return (int) $value;
    }

    private function distinguishedName(mixed $value): ?string
    {
        if (! is_array($value)) {
            return null;
        }

        $parts = [];

        foreach ($value as $key => $part) {
            if (! is_string($key)) {
                continue;
            }

            if (is_scalar($part)) {
                $parts[] = $key.'='.$part;
            }
        }

        return $parts === [] ? null : implode(', ', $parts);
    }

    private function distinguishedNameContainsRuc(mixed $value, string $expectedRuc): bool
    {
        if (is_array($value)) {
            foreach ($value as $part) {
                if ($this->distinguishedNameContainsRuc($part, $expectedRuc)) {
                    return true;
                }
            }

            return false;
        }

        if (! is_scalar($value)) {
            return false;
        }

        preg_match_all('/(?<!\d)\d{11}(?!\d)/', (string) $value, $matches);
        $rucs = $matches[0] ?? [];

        return is_array($rucs) && in_array($expectedRuc, $rucs, true);
    }

    private function certificateDisk(): string
    {
        $diskName = config('fiscal.certificate_disk');

        throw_if(! is_string($diskName) || $diskName === '', LogicException::class, 'El disco de certificados fiscales no está configurado.');

        return $diskName;
    }

    /**
     * @throws ValidationException
     */
    private function invalidCertificate(string $message): never
    {
        throw ValidationException::withMessages([
            'certificate' => [$message],
        ]);
    }
}
