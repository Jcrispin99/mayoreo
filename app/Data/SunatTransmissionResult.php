<?php

declare(strict_types=1);

namespace App\Data;

final readonly class SunatTransmissionResult
{
    /**
     * @param  list<string>  $notes
     */
    public function __construct(
        public string $xml,
        public ?string $cdrZip,
        public string $status,
        public ?string $cdrCode = null,
        public ?string $cdrDescription = null,
        public array $notes = [],
        public ?string $errorCode = null,
        public ?string $errorMessage = null,
    ) {}
}
