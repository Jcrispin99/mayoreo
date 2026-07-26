<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\SunatEnvironment;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FiscalCredential>
 */
final class FiscalCredentialFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'fiscal_issuer_id' => FiscalIssuer::factory(),
            'environment' => SunatEnvironment::Beta,
        ];
    }
}
