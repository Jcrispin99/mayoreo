<?php

declare(strict_types=1);

return [
    'certificate_disk' => env('FISCAL_CERTIFICATE_DISK', 'fiscal-certificates'),
    'document_disk' => env('FISCAL_DOCUMENT_DISK', 'fiscal-documents'),
    'certificate_max_size_kb' => 5120,
    'certificate_staging_grace_minutes' => 60,
    'certificate_cleanup_retry_minutes' => 15,
];
