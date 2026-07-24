<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\PosPaymentMethod;
use App\Http\Controllers\Api\ApiController;
use Illuminate\Http\JsonResponse;

final class PosPaymentMethodController extends ApiController
{
    public function index(): JsonResponse
    {
        $methods = array_map(
            static fn (PosPaymentMethod $method): array => [
                'code' => $method->value,
                'label' => $method->label(),
                'description' => $method->description(),
                'requires_received_amount' => $method->requiresReceivedAmount(),
                'supports_reference' => $method->supportsReference(),
            ],
            PosPaymentMethod::cases(),
        );

        return $this->success($methods);
    }
}
