<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\SunatEnvironment;
use App\Exceptions\FiscalCertificateUnavailableException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\UpdateFiscalCredentialRequest;
use App\Http\Resources\FiscalIssuerResource;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use App\Services\FiscalCertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

final class FiscalCredentialController extends ApiController
{
    public function update(
        UpdateFiscalCredentialRequest $request,
        FiscalIssuer $fiscalIssuer,
        FiscalCertificateService $certificateService,
    ): JsonResponse {
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

        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->success(
            new FiscalIssuerResource($fiscalIssuer),
            'Credenciales fiscales actualizadas'
        );
    }

    public function destroy(
        Request $request,
        FiscalIssuer $fiscalIssuer,
    ): JsonResponse {
        $userId = $request->user()?->id;

        throw_if($userId === null, LogicException::class, 'No se pudo resolver el usuario autenticado.');

        DB::transaction(function () use ($fiscalIssuer, $userId): void {
            FiscalIssuer::query()
                ->whereKey($fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();

            FiscalCredential::query()
                ->where('fiscal_issuer_id', $fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail()
                ->forceFill([
                    'environment' => SunatEnvironment::Beta,
                    'sol_username' => null,
                    'sol_password' => null,
                    'updated_by_user_id' => $userId,
                ])
                ->save();
        });

        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->success(
            new FiscalIssuerResource($fiscalIssuer),
            'Credenciales SOL eliminadas'
        );
    }
}
