<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\Pos\ResolveDefaultPosCustomerAction;
use App\Models\PosOrder;
use Illuminate\Database\Seeder;

final class DefaultPosCustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customer = app(ResolveDefaultPosCustomerAction::class)->execute();

        PosOrder::query()
            ->where('status', 'open')
            ->whereNull('customer_id')
            ->update(['customer_id' => $customer->id]);
    }
}
