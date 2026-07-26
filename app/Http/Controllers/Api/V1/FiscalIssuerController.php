<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\SunatEnvironment;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreFiscalIssuerRequest;
use App\Http\Requests\Api\V1\UpdateFiscalIssuerRequest;
use App\Http\Resources\FiscalIssuerResource;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class FiscalIssuerController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $fiscalIssuers = FiscalIssuer::query()
            ->with('credential')
            ->withCount('stores')
            ->when(
                $request->filled('is_active'),
                fn ($query) => $query->where('is_active', $request->boolean('is_active'))
            )
            ->orderBy('legal_name')
            ->get();

        return $this->success(FiscalIssuerResource::collection($fiscalIssuers));
    }

    public function store(StoreFiscalIssuerRequest $request): JsonResponse
    {
        $fiscalIssuer = DB::transaction(function () use ($request): FiscalIssuer {
            $fiscalIssuer = FiscalIssuer::query()->create($request->validated());
            $fiscalIssuer->credential()->create([
                'environment' => SunatEnvironment::Beta,
                'updated_by_user_id' => $request->user()?->id,
            ]);

            return $fiscalIssuer;
        });

        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->created(new FiscalIssuerResource($fiscalIssuer), 'Emisor fiscal creado');
    }

    public function show(FiscalIssuer $fiscalIssuer): JsonResponse
    {
        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->success(new FiscalIssuerResource($fiscalIssuer));
    }

    public function update(
        UpdateFiscalIssuerRequest $request,
        FiscalIssuer $fiscalIssuer,
    ): JsonResponse {
        DB::transaction(function () use ($request, $fiscalIssuer): void {
            $lockedIssuer = FiscalIssuer::query()
                ->whereKey($fiscalIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();
            $attributes = $request->validated();
            $newRuc = $attributes['ruc'] ?? $lockedIssuer->ruc;
            $credential = FiscalCredential::query()
                ->where('fiscal_issuer_id', $lockedIssuer->id)
                ->lockForUpdate()
                ->firstOrFail();
            $hasStores = $lockedIssuer->stores()
                ->lockForUpdate()
                ->exists();
            $hasSeries = $lockedIssuer->documentSeries()
                ->lockForUpdate()
                ->exists();
            $hasDocuments = $lockedIssuer->fiscalDocuments()
                ->lockForUpdate()
                ->exists();

            if ($newRuc !== $lockedIssuer->ruc
                && ($credential->hasCertificate()
                    || $credential->hasSolCredentials()
                    || $hasStores
                    || $hasSeries
                    || $hasDocuments)) {
                throw ValidationException::withMessages([
                    'ruc' => [
                        'No puede cambiar el RUC de un emisor con credenciales, establecimientos, series o documentos fiscales.',
                    ],
                ]);
            }

            $lockedIssuer->update($attributes);
        });

        $fiscalIssuer->refresh();
        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->success(new FiscalIssuerResource($fiscalIssuer), 'Emisor fiscal actualizado');
    }
}
