<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Normalize prices shown as standard selling prices while preserving
     * package and sack rates that may need sub-cent unit precision.
     */
    public function up(): void
    {
        DB::table('price_tiers')
            ->select(['id', 'unit_price'])
            ->whereIn('label', ['Por kilo', 'Por litro', 'Venta unitaria'])
            ->orderBy('id')
            ->chunkById(200, function ($tiers): void {
                foreach ($tiers as $tier) {
                    if (! is_numeric($tier->id) || ! is_numeric($tier->unit_price)) {
                        continue;
                    }

                    DB::table('price_tiers')
                        ->where('id', (int) $tier->id)
                        ->update([
                            'unit_price' => $this->roundToCents((string) $tier->unit_price),
                        ]);
                }
            });

    }

    public function down(): void
    {
        // The original sub-cent standard prices cannot be reconstructed safely.
    }

    /**
     * @param  numeric-string  $price
     * @return numeric-string
     */
    private function roundToCents(string $price): string
    {
        /** @var numeric-string $rounded */
        $rounded = bcadd($price, '0.005', 2);

        return $rounded;
    }
};
