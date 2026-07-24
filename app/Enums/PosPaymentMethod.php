<?php

declare(strict_types=1);

namespace App\Enums;

enum PosPaymentMethod: string
{
    case Cash = 'cash';
    case Card = 'card';
    case Yape = 'yape';
    case Plin = 'plin';
    case BankTransfer = 'bank_transfer';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(
            static fn (self $method): string => $method->value,
            self::cases(),
        );
    }

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Efectivo',
            self::Card => 'Tarjeta',
            self::Yape => 'Yape',
            self::Plin => 'Plin',
            self::BankTransfer => 'Transferencia bancaria',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Cash => 'Registra el efectivo recibido y calcula el vuelto.',
            self::Card => 'Registra un cobro realizado en un terminal externo.',
            self::Yape => 'Registra una operación de Yape realizada externamente.',
            self::Plin => 'Registra una operación de Plin realizada externamente.',
            self::BankTransfer => 'Registra una transferencia bancaria realizada externamente.',
        };
    }

    public function requiresReceivedAmount(): bool
    {
        return $this === self::Cash;
    }

    public function supportsReference(): bool
    {
        return $this !== self::Cash;
    }
}
