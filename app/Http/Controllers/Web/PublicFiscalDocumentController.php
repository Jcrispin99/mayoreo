<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\FiscalDocument;
use App\Models\FiscalDocumentDelivery;
use App\Services\FiscalDocumentRepresentationService;
use Illuminate\Http\Response;

final class PublicFiscalDocumentController extends Controller
{
    public function __invoke(
        string $token,
        FiscalDocumentRepresentationService $representationService,
    ): Response {
        $delivery = FiscalDocumentDelivery::query()
            ->with('fiscalDocument')
            ->where('access_token', $token)
            ->firstOrFail();

        if ($delivery->opened_at === null) {
            $delivery->forceFill(['opened_at' => now()])->save();
        }

        $document = $delivery->fiscalDocument;
        abort_unless($document instanceof FiscalDocument, 404);

        return response($representationService->render($document)->render())
            ->header('Content-Type', 'text/html; charset=UTF-8')
            ->header('Cache-Control', 'private, no-store');
    }
}
