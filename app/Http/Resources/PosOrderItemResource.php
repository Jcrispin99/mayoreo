<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\Productable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Productable */
final class PosOrderItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $product = $this->product;
        $productData = null;

        if ($this->relationLoaded('product') && $product instanceof Product) {
            $productData = [
                'id' => $product->id,
                'product_template_id' => $product->product_template_id,
                'sku' => $product->sku,
                'barcode' => $product->barcode,
                'name' => $product->display_name,
                'variant_name' => $product->variant_name,
                'image_url' => $product->image_url,
                'base_unit' => new UnitOfMeasureResource($product->baseUnit),
                'sale_mode' => $product->sale_mode,
                'content_quantity' => $product->content_quantity,
                'content_unit' => new UnitOfMeasureResource($product->contentUnit),
                'price_tiers' => PriceTierResource::collection(
                    $product->relationLoaded('priceTiers') ? $product->priceTiers : collect(),
                ),
            ];
        }

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->when($productData !== null, $productData),
            'quantity' => $this->quantity,
            'warehouse_notes' => $this->warehouse_notes,
            'input_quantity' => $this->input_quantity,
            'input_unit_id' => $this->input_unit_id,
            'price_tier_id' => $this->price_tier_id,
            'unit_price' => $this->unit_price,
            'line_total' => $this->line_total,
        ];
    }
}
