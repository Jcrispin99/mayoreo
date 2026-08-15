<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class ProductBarcodeGenerator
{
    private const CODE_SPACE = 1_000_000;

    private const SEQUENCE_ID = 1;

    public function generate(): string
    {
        return DB::transaction(function (): string {
            $sequence = DB::table('product_barcode_sequences')
                ->where('id', self::SEQUENCE_ID)
                ->lockForUpdate()
                ->first();

            if (! is_object($sequence) || ! property_exists($sequence, 'current_number')) {
                throw new RuntimeException('No se encontró la secuencia para códigos de barras de productos.');
            }

            $currentNumber = is_numeric($sequence->current_number)
                ? (int) $sequence->current_number
                : 0;

            for ($attempt = 0; $attempt < self::CODE_SPACE; $attempt++) {
                $currentNumber = ($currentNumber + 1) % self::CODE_SPACE;
                $barcode = mb_str_pad((string) $currentNumber, 6, '0', STR_PAD_LEFT);
                $alreadyExists = Product::withTrashed()
                    ->where('barcode', $barcode)
                    ->exists();

                if ($alreadyExists) {
                    continue;
                }

                DB::table('product_barcode_sequences')
                    ->where('id', self::SEQUENCE_ID)
                    ->update(['current_number' => $currentNumber]);

                return $barcode;
            }

            throw new RuntimeException('Se agotaron los códigos de barras de seis dígitos.');
        }, 5);
    }
}
