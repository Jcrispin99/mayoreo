<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\UploadFiscalCertificateRequest;
use App\Http\Resources\FiscalIssuerResource;
use App\Models\FiscalIssuer;
use App\Services\FiscalCertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use LogicException;

final class FiscalCertificateController extends ApiController
{
    public function store(
        UploadFiscalCertificateRequest $request,
        FiscalIssuer $fiscalIssuer,
        FiscalCertificateService $certificateService,
    ): JsonResponse {
        $certificate = $request->file('certificate');
        $userId = $request->user()?->id;

        throw_if(! $certificate instanceof UploadedFile || $userId === null, LogicException::class, 'No se pudo resolver el certificado o el usuario autenticado.');

        $certificateService->replace(
            $fiscalIssuer,
            $certificate,
            $request->certificatePassword(),
            $userId,
        );

        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->success(
            new FiscalIssuerResource($fiscalIssuer),
            'Certificado fiscal cargado'
        );
    }

    public function destroy(
        Request $request,
        FiscalIssuer $fiscalIssuer,
        FiscalCertificateService $certificateService,
    ): JsonResponse {
        $userId = $request->user()?->id;

        throw_if($userId === null, LogicException::class, 'No se pudo resolver el usuario autenticado.');

        $certificateService->remove($fiscalIssuer, $userId);
        $fiscalIssuer->load('credential')->loadCount('stores');

        return $this->success(
            new FiscalIssuerResource($fiscalIssuer),
            'Certificado fiscal eliminado'
        );
    }
}
