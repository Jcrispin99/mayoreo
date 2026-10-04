<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\FiscalDocument;
use Illuminate\Contracts\View\View;

final class FiscalDocumentRepresentationService
{
    public function render(FiscalDocument $document): View
    {
        $document->loadMissing([
            'sale.items.product.template',
            'sale.items.inputUnit',
            'sale.payments',
        ]);

        return view('fiscal-documents.representation', [
            'document' => $document,
            'sale' => $document->sale,
        ]);
    }
}
