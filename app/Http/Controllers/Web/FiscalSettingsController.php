<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Enums\SunatEnvironment;
use App\Exceptions\FiscalCertificateUnavailableException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreFiscalIssuerRequest;
use App\Http\Requests\Api\V1\UpdateFiscalCredentialRequest;
use App\Http\Requests\Api\V1\UpdateFiscalIssuerRequest;
use App\Http\Requests\Api\V1\UploadFiscalCertificateRequest;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use App\Services\FiscalCertificateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;

final class FiscalSettingsController extends Controller
{
    public function index(): Response
    {
        $issuers = FiscalIssuer::query()
            ->with('credential')
            ->withCount('stores')
            ->orderBy('legal_name')
            ->get();

        return Inertia::render('fiscal-settings/index', [
            'issuers' => $issuers->map(fn (FiscalIssuer $issuer): array => $this->issuerPayload($issuer)),
        ]);
    }

    public function store(StoreFiscalIssuerRequest $request): RedirectResponse
    {
        $issuer = DB::transaction(function () use ($request): FiscalIssuer {
            $issuer = FiscalIssuer::query()->create($request->validated());
            $issuer->credential()->create([
                'environment' => SunatEnvironment::Beta,
                'updated_by_user_id' => $request->user()?->id,
            ]);

            return $issuer;
        });

        return redirect()->route('fiscal-settings.index');
    }

    public function update(UpdateFiscalIssuerRequest $request, FiscalIssuer $fiscalIssuer): RedirectResponse
    {
        $fiscalIssuer->update($request->validated());

        return back();
    }

    public function updateCredentials(
        UpdateFiscalCredentialRequest $request,
        FiscalIssuer $fiscalIssuer,
        FiscalCertificateService $certificateService,
    ): RedirectResponse {
        DB::transaction(function () use ($request, $fiscalIssuer, $certificateService): void {
            $currentIssuer = FiscalIssuer::query()
                ->whereKey($fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $credential = FiscalCredential::query()
                ->where('fiscal_issuer_id', $fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();

            $credential->fill($request->validated());
            $credential->updated_by_user_id = $request->user()?->id;

            if ($credential->environment === SunatEnvironment::Production
                && (! $currentIssuer->is_active
                    || ! $credential->hasSolCredentials()
                    || ! $credential->certificateMeetsProductionRequirements())) {
                throw ValidationException::withMessages([
                    'environment' => [
                        'Producción requiere un emisor activo, credenciales SOL y un certificado vigente, no autofirmado y vinculado al RUC.',
                    ],
                ]);
            }

            if ($credential->environment === SunatEnvironment::Production) {
                try {
                    $certificateService->contents($credential);
                } catch (FiscalCertificateUnavailableException $exception) {
                    report($exception);

                    throw ValidationException::withMessages([
                        'environment' => [
                            'No se pudo leer o verificar la integridad del certificado almacenado.',
                        ],
                    ]);
                }
            }

            $credential->save();
        });

        return back();
    }

    public function storeCertificate(
        UploadFiscalCertificateRequest $request,
        FiscalIssuer $fiscalIssuer,
        FiscalCertificateService $certificateService,
    ): RedirectResponse {
        $certificate = $request->file('certificate');
        $userId = $request->user()?->id;

        throw_if(! $certificate instanceof UploadedFile || $userId === null, LogicException::class, 'No se pudo resolver el certificado o el usuario autenticado.');

        $certificateService->replace(
            $fiscalIssuer,
            $certificate,
            $request->certificatePassword(),
            $userId,
        );

        return back();
    }

    public function destroyCertificate(
        FiscalIssuer $fiscalIssuer,
        FiscalCertificateService $certificateService,
    ): RedirectResponse {
        $userId = request()->user()?->id;

        throw_if($userId === null, LogicException::class, 'No se pudo resolver el usuario autenticado.');

        $certificateService->remove($fiscalIssuer, $userId);

        return back();
    }

    /** @return array<string, mixed> */
    private function issuerPayload(FiscalIssuer $issuer): array
    {
        $credential = $issuer->credential;

        return [
            'id' => $issuer->id,
            'ruc' => $issuer->ruc,
            'legal_name' => $issuer->legal_name,
            'trade_name' => $issuer->trade_name,
            'fiscal_address' => $issuer->fiscal_address,
            'ubigeo' => $issuer->ubigeo,
            'urbanization' => $issuer->urbanization,
            'department' => $issuer->department,
            'province' => $issuer->province,
            'district' => $issuer->district,
            'phone' => $issuer->phone,
            'email' => $issuer->email,
            'is_active' => $issuer->is_active,
            'stores_count' => $issuer->stores_count,
            'configuration_complete' => $issuer->is_active && $credential?->configurationIsComplete() === true,
            'credential' => $credential === null ? null : [
                'environment' => $credential->environment->value,
                'has_sol_username' => filled($credential->sol_username),
                'has_sol_password' => filled($credential->sol_password),
                'has_sol_credentials' => $credential->hasSolCredentials(),
                'has_certificate' => $credential->hasCertificate(),
                'certificate' => $credential->hasCertificate() ? [
                    'original_name' => $credential->certificate_original_name,
                    'source_format' => $credential->certificate_source_format,
                    'fingerprint_sha256' => $credential->certificate_fingerprint_sha256,
                    'matches_ruc' => $credential->certificate_matches_ruc,
                    'is_self_signed' => $credential->certificate_is_self_signed,
                    'key_algorithm' => $credential->certificate_key_algorithm,
                    'key_size' => $credential->certificate_key_size,
                    'valid_from' => $credential->certificate_valid_from?->toIso8601String(),
                    'expires_at' => $credential->certificate_expires_at?->toIso8601String(),
                    'uploaded_at' => $credential->certificate_uploaded_at?->toIso8601String(),
                    'is_expired' => $credential->certificate_expires_at?->isPast() ?? false,
                    'meets_production_requirements' => $credential->certificateMeetsProductionRequirements(),
                ] : null,
            ],
        ];
    }
}
