<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Models\Customer;

final readonly class ResolveDefaultPosCustomerAction
{
    public const DOCUMENT_NUMBER = '00000000';

    public function execute(): Customer
    {
        return Customer::query()->updateOrCreate(
            ['document_number' => self::DOCUMENT_NUMBER],
            [
                'name' => 'Varios',
                'phone' => '999999999',
                'email' => 'varios@mayoreo.test',
                'address' => 'Cliente genérico para ventas de prueba del POS',
                'is_active' => true,
            ],
        );
    }
}
