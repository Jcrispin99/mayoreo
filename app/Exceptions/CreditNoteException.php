<?php

declare(strict_types=1);

namespace App\Exceptions;

final class CreditNoteException extends DomainException
{
    public static function invalidReasonCode(string $reasonCode): self
    {
        return new self("El motivo [{$reasonCode}] no es un código válido del Catálogo 09 de SUNAT.");
    }

    public static function emptyItems(): self
    {
        return new self('Selecciona al menos un ítem para la devolución.');
    }

    public static function unsupportedDocumentType(string $documentType): self
    {
        return new self("Solo se puede emitir una nota de crédito sobre una boleta o factura, no sobre [{$documentType}].");
    }

    public static function documentNotAccepted(int $documentId): self
    {
        return new self("El documento [{$documentId}] todavía no fue aceptado por SUNAT y no se le puede emitir una nota de crédito.");
    }

    public static function alreadyCredited(int $documentId): self
    {
        return new self("El documento [{$documentId}] ya tiene una nota de crédito emitida.");
    }

    public static function itemNotInSale(int $saleItemId, int $saleId): self
    {
        return new self("El ítem [{$saleItemId}] no pertenece a la venta [{$saleId}] original.");
    }

    public static function duplicateItem(int $saleItemId): self
    {
        return new self("El ítem [{$saleItemId}] está repetido en la devolución.");
    }

    public static function invalidQuantity(int $saleItemId, string $quantity): self
    {
        return new self("La cantidad [{$quantity}] a devolver del ítem [{$saleItemId}] es inválida o excede lo vendido.");
    }

    public static function incompleteTotalReturn(): self
    {
        return new self('La devolución total debe incluir todos los productos con la cantidad completa vendida.');
    }

    public static function noActiveSeries(int $fiscalIssuerId, string $prefix, string $documentType): self
    {
        $original = $documentType === 'receipt' ? 'boleta' : 'factura';

        return new self("El emisor [{$fiscalIssuerId}] no tiene una serie activa de nota de crédito con prefijo [{$prefix}] para una {$original}.");
    }
}
