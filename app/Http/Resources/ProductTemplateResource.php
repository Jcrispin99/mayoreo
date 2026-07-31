<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProductAttributeValue;
use App\Models\ProductTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProductTemplate */
final class ProductTemplateResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $attributes = $this->relationLoaded('attributeValues')
            ? $this->attributeValues
                ->groupBy('product_attribute_id')
                ->map(function ($values): array {
                    $first = $values->first();
                    if (! $first instanceof ProductAttributeValue) {
                        return ['id' => 0, 'name' => '', 'values' => []];
                    }

                    return [
                        'id' => $first->attribute->id,
                        'name' => $first->attribute->name,
                        'values' => $values->map(function (ProductAttributeValue $value): array {
                            /** @var int|float|string|null $rawPrice */
                            $rawPrice = $value->pivot->getAttribute('price');
                            /** @var int|float|string|null $rawFactor */
                            $rawFactor = $value->pivot->getAttribute('factor');

                            return [
                                'id' => $value->id,
                                'value' => $value->value,
                                'price' => number_format((float) ($rawPrice ?? 0), 4, '.', ''),
                                'factor' => $rawFactor === null
                                    ? null
                                    : number_format((float) $rawFactor, 6, '.', ''),
                            ];
                        })->values(),
                    ];
                })
                ->filter(fn (array $attribute): bool => $attribute['id'] !== 0)
                ->values()
            : [];

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'default_price' => $this->default_price,
            'image_url' => $this->image_url,
            'is_active' => $this->is_active,
            'is_pos_visible' => $this->is_pos_visible,
            'attributes' => $attributes,
            'variants' => ProductResource::collection($this->whenLoaded('variants')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
