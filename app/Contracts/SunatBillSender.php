<?php

declare(strict_types=1);

namespace App\Contracts;

use App\Data\SunatTransmissionResult;
use App\Models\FiscalDocument;

interface SunatBillSender
{
    public function send(FiscalDocument $document): SunatTransmissionResult;
}
