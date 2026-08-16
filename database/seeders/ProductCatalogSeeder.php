<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductPurchaseUnit;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use Illuminate\Database\Seeder;

final class ProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $kilograms = UnitOfMeasure::query()->updateOrCreate(
            ['code' => 'kg'],
            ['name' => 'Kilogramos', 'type' => 'weight'],
        );
        $units = UnitOfMeasure::query()->updateOrCreate(
            ['code' => 'NIU'],
            ['name' => 'Unidad', 'type' => 'count'],
        );
        $presentation = ProductAttribute::query()->updateOrCreate(
            ['name' => 'Presentación'],
            ['is_active' => true],
        );

        $this->seedArrozExtra($presentation, $kilograms, $units);
        $this->seedAceiteVegetal($presentation, $units);
        $this->seedAzucarRubia($presentation, $kilograms, $units);
        $this->seedGaseosa($units);
    }

    private function seedArrozExtra(
        ProductAttribute $presentation,
        UnitOfMeasure $kilograms,
        UnitOfMeasure $units,
    ): void {
        $template = $this->template(
            'Arroz Extra',
            'Arroz vendido a granel, por kilo o en saco de 50 kg.',
        );
        $oneKilogram = $this->attributeValue($presentation, '1 kg');
        $sack50Kilograms = $this->attributeValue($presentation, 'Saco 50 kg');
        $this->syncTemplateValues($template, [
            [$oneKilogram, 0, '5.0000', '1.000000'],
            [$sack50Kilograms, 1, '210.0000', '50.000000'],
        ]);

        $principal = $this->product($template, [
            'sku' => 'ARROZ-EXTRA-GRANEL',
            'barcode' => null,
            'name' => 'Arroz Extra - Granel',
            'variant_name' => 'Granel (stock)',
            'base_unit_id' => $kilograms->id,
            'sale_mode' => 'measured',
            'content_quantity' => null,
            'content_unit_id' => null,
            'is_principal' => true,
            'is_favorite' => true,
        ]);
        $this->priceTiers($principal, [
            ['label' => 'Menudeo', 'min' => '0.001', 'max' => '0.999999', 'price' => '5.5000'],
            ['label' => 'Desde 1 kg', 'min' => '1', 'max' => null, 'price' => '4.8000'],
        ]);
        $this->purchaseUnits($principal, [
            ['name' => 'Kilogramo', 'factor' => '1', 'default' => false],
            ['name' => 'Saco 50 kg', 'factor' => '50', 'default' => true],
        ]);

        $kilogram = $this->product($template, [
            'sku' => 'ARROZ-EXTRA-1KG',
            'barcode' => '7750000000011',
            'name' => 'Arroz Extra - 1 kg',
            'variant_name' => '1 kg',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => '1',
            'content_unit_id' => $kilograms->id,
            'is_principal' => false,
            'is_favorite' => true,
        ]);
        $kilogram->attributeValues()->sync([$oneKilogram->id]);
        $this->priceTiers($kilogram, [
            ['label' => 'Precio por bolsa', 'min' => '1', 'max' => null, 'price' => '5.0000'],
        ]);

        $sack = $this->product($template, [
            'sku' => 'ARROZ-EXTRA-SACO-50KG',
            'barcode' => '7750000000028',
            'name' => 'Arroz Extra - Saco 50 kg',
            'variant_name' => 'Saco 50 kg',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => '50',
            'content_unit_id' => $kilograms->id,
            'is_principal' => false,
            'is_favorite' => false,
        ]);
        $sack->attributeValues()->sync([$sack50Kilograms->id]);
        $this->priceTiers($sack, [
            ['label' => 'Precio por saco', 'min' => '1', 'max' => null, 'price' => '210.0000'],
        ]);
    }

    private function seedAceiteVegetal(
        ProductAttribute $presentation,
        UnitOfMeasure $units,
    ): void {
        Product::query()
            ->where('sku', 'ACEITE-VEGETAL-GRANEL')
            ->update(['is_active' => false, 'is_principal' => false]);

        $template = $this->template(
            'Aceite Vegetal',
            'Aceite controlado por botella de 1 L o bidón de 20 L.',
        );
        $drum20Liters = $this->attributeValue($presentation, 'Bidón 20 L');
        $this->syncTemplateValues($template, [
            [$drum20Liters, 0, '200.0000', '1.000000'],
        ]);

        $principal = $this->product($template, [
            'sku' => 'ACEITE-VEGETAL-1L',
            'barcode' => '7750000000035',
            'name' => 'Aceite Vegetal - 1 L',
            'variant_name' => '1 L',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => null,
            'content_unit_id' => null,
            'is_principal' => true,
            'is_favorite' => true,
        ]);
        $principal->attributeValues()->sync([]);
        $this->priceTiers($principal, [
            ['label' => 'Precio por botella', 'min' => '1', 'max' => null, 'price' => '12.0000'],
        ]);
        $this->purchaseUnits($principal, [
            ['name' => 'Unidad', 'factor' => '1', 'default' => true],
        ]);

        $drum = $this->product($template, [
            'sku' => 'ACEITE-VEGETAL-BIDON-20L',
            'barcode' => '7750000000042',
            'name' => 'Aceite Vegetal - Bidón 20 L',
            'variant_name' => 'Bidón 20 L',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => null,
            'content_unit_id' => null,
            'is_principal' => false,
            'is_favorite' => false,
        ]);
        $drum->attributeValues()->sync([$drum20Liters->id]);
        $this->priceTiers($drum, [
            ['label' => 'Precio por bidón', 'min' => '1', 'max' => null, 'price' => '200.0000'],
        ]);
        $this->purchaseUnits($drum, [
            ['name' => 'Unidad', 'factor' => '1', 'default' => true],
        ]);
    }

    private function seedAzucarRubia(
        ProductAttribute $presentation,
        UnitOfMeasure $kilograms,
        UnitOfMeasure $units,
    ): void {
        $template = $this->template(
            'Azúcar Rubia',
            'Azúcar vendida a granel, por kilo o en saco de 50 kg.',
        );
        $oneKilogram = $this->attributeValue($presentation, '1 kg');
        $sack50Kilograms = $this->attributeValue($presentation, 'Saco 50 kg');
        $this->syncTemplateValues($template, [
            [$oneKilogram, 0, '4.8000', '1.000000'],
            [$sack50Kilograms, 1, '195.0000', '50.000000'],
        ]);

        $principal = $this->product($template, [
            'sku' => 'AZUCAR-RUBIA-GRANEL',
            'barcode' => null,
            'name' => 'Azúcar Rubia - Granel',
            'variant_name' => 'Granel (stock)',
            'base_unit_id' => $kilograms->id,
            'sale_mode' => 'measured',
            'content_quantity' => null,
            'content_unit_id' => null,
            'is_principal' => true,
            'is_favorite' => false,
        ]);
        $this->priceTiers($principal, [
            ['label' => 'Menudeo', 'min' => '0.001', 'max' => '0.999999', 'price' => '5.2000'],
            ['label' => 'Desde 1 kg', 'min' => '1', 'max' => null, 'price' => '4.5000'],
        ]);
        $this->purchaseUnits($principal, [
            ['name' => 'Kilogramo', 'factor' => '1', 'default' => false],
            ['name' => 'Saco 50 kg', 'factor' => '50', 'default' => true],
        ]);

        $kilogram = $this->product($template, [
            'sku' => 'AZUCAR-RUBIA-1KG',
            'barcode' => '7750000000059',
            'name' => 'Azúcar Rubia - 1 kg',
            'variant_name' => '1 kg',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => '1',
            'content_unit_id' => $kilograms->id,
            'is_principal' => false,
            'is_favorite' => false,
        ]);
        $kilogram->attributeValues()->sync([$oneKilogram->id]);
        $this->priceTiers($kilogram, [
            ['label' => 'Precio por bolsa', 'min' => '1', 'max' => null, 'price' => '4.8000'],
        ]);

        $sack = $this->product($template, [
            'sku' => 'AZUCAR-RUBIA-SACO-50KG',
            'barcode' => '7750000000066',
            'name' => 'Azúcar Rubia - Saco 50 kg',
            'variant_name' => 'Saco 50 kg',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => '50',
            'content_unit_id' => $kilograms->id,
            'is_principal' => false,
            'is_favorite' => false,
        ]);
        $sack->attributeValues()->sync([$sack50Kilograms->id]);
        $this->priceTiers($sack, [
            ['label' => 'Precio por saco', 'min' => '1', 'max' => null, 'price' => '195.0000'],
        ]);
    }

    private function seedGaseosa(UnitOfMeasure $units): void
    {
        $template = $this->template(
            'Gaseosa Cola 500 ml',
            'Producto unitario de prueba para ventas POS.',
        );
        $template->attributeValues()->sync([]);

        $product = $this->product($template, [
            'sku' => 'GASEOSA-COLA-500ML',
            'barcode' => '7750000000073',
            'name' => 'Gaseosa Cola 500 ml',
            'variant_name' => 'Unidad',
            'base_unit_id' => $units->id,
            'sale_mode' => 'unit',
            'content_quantity' => null,
            'content_unit_id' => null,
            'is_principal' => true,
            'is_favorite' => true,
        ]);
        $this->priceTiers($product, [
            ['label' => 'Precio por unidad', 'min' => '1', 'max' => null, 'price' => '3.5000'],
        ]);
        $this->purchaseUnits($product, [
            ['name' => 'Caja x 24', 'factor' => '24', 'default' => true],
        ]);
    }

    private function template(string $name, string $description): ProductTemplate
    {
        return ProductTemplate::query()->updateOrCreate(
            ['name' => $name],
            [
                'description' => $description,
                'is_active' => true,
                'is_pos_visible' => true,
            ],
        );
    }

    /**
     * @param array{
     *     sku: string,
     *     barcode: string|null,
     *     name: string,
     *     variant_name: string,
     *     base_unit_id: int,
     *     sale_mode: string,
     *     content_quantity: string|null,
     *     content_unit_id: int|null,
     *     is_principal: bool,
     *     is_favorite: bool
     * } $values
     */
    private function product(ProductTemplate $template, array $values): Product
    {
        $productValues = [
            ...$values,
            'product_template_id' => $template->id,
            'description' => $template->description,
            'is_active' => true,
        ];
        if ($values['barcode'] === null) {
            unset($productValues['barcode']);
        }

        return Product::query()->updateOrCreate(
            ['sku' => $values['sku']],
            $productValues,
        );
    }

    private function attributeValue(
        ProductAttribute $attribute,
        string $value,
    ): ProductAttributeValue {
        return ProductAttributeValue::query()->updateOrCreate(
            ['product_attribute_id' => $attribute->id, 'value' => $value],
            ['is_active' => true],
        );
    }

    /**
     * @param  list<array{ProductAttributeValue, int, numeric-string, numeric-string}>  $values
     */
    private function syncTemplateValues(ProductTemplate $template, array $values): void
    {
        $sync = [];

        foreach ($values as [$value, $position, $price, $factor]) {
            $sync[$value->id] = [
                'position' => $position,
                'price' => $price,
                'factor' => $factor,
            ];
        }

        $template->attributeValues()->sync($sync);
    }

    /**
     * @param list<array{
     *     label: string,
     *     min: numeric-string,
     *     max: numeric-string|null,
     *     price: numeric-string
     * }> $tiers
     */
    private function priceTiers(Product $product, array $tiers): void
    {
        $product->priceTiers()->delete();

        foreach ($tiers as $tier) {
            PriceTier::query()->create([
                'product_id' => $product->id,
                'label' => $tier['label'],
                'min_quantity' => $tier['min'],
                'max_quantity' => $tier['max'],
                'unit_price' => $tier['price'],
                'is_active' => true,
            ]);
        }
    }

    /**
     * @param  list<array{name: string, factor: numeric-string, default: bool}>  $units
     */
    private function purchaseUnits(Product $product, array $units): void
    {
        $processedIds = [];

        foreach ($units as $unit) {
            $purchaseUnit = ProductPurchaseUnit::query()->updateOrCreate(
                ['product_id' => $product->id, 'name' => $unit['name']],
                [
                    'conversion_factor' => $unit['factor'],
                    'is_default_purchase' => $unit['default'],
                ],
            );
            $processedIds[] = $purchaseUnit->id;
        }

        $product->purchaseUnits()->whereNotIn('id', $processedIds)->delete();
    }
}
