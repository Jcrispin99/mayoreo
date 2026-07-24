<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Models\FiscalDocument;
use App\Models\PosOrder;
use App\Models\Sale;
use App\Models\SalePayment;

final readonly class CompletePosOrderResult
{
    public function __construct(
        public PosOrder $order,
        public Sale $sale,
        public SalePayment $payment,
        public FiscalDocument $fiscalDocument,
        public bool $created,
    ) {}
}
