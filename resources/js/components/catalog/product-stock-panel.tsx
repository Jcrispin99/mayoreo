import { Link } from "@inertiajs/react"
import { ArrowLeftRightIcon, BoxesIcon, SlidersHorizontalIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { StockAdjustmentDialog, type StockProductOption } from "@/components/catalog/stock-adjustment-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { api } from "@/lib/api"
import { formatDateTime, formatDecimal, formatMoney, formatQuantity, unitShort, variantLabel } from "@/lib/catalog-format"
import type { ProductTemplate, StockRecord, Unit, Variant, Warehouse } from "@/types/catalog"

/** Lleva stock propio: la principal o una presentación sin contenido declarado. */
export function holdsOwnStock(variant: Pick<Variant, "is_principal" | "content_quantity">) {
  return variant.is_principal || variant.content_quantity === null
}

type ProductStockPanelProps = {
  template: ProductTemplate
  units: Unit[]
  canManage: boolean
  canSeeWarehouses: boolean
}

export function ProductStockPanel({ template, units, canManage, canSeeWarehouses }: ProductStockPanelProps) {
  const [adjusting, setAdjusting] = useState<{ productId: number; warehouseId: number | null } | null>(null)
  const stockVariants = useMemo(
    () => template.variants.filter((variant) => variant.is_active && holdsOwnStock(variant)),
    [template],
  )
  const derived = template.variants.filter((variant) => variant.is_active && !holdsOwnStock(variant))

  const { data, loading, error, reload } = useApi(async () => {
    const [stocks, warehouses] = await Promise.all([
      Promise.all(stockVariants.map((variant) => api.get<StockRecord[]>("/stocks", { product_id: variant.id }))).then((lists) => lists.flat()),
      canSeeWarehouses ? api.get<Warehouse[]>("/warehouses", { is_active: true }) : Promise.resolve([] as Warehouse[]),
    ])
    return { stocks, warehouses }
  }, [stockVariants, canSeeWarehouses], "No se pudo cargar el stock.")

  const unitOf = (variant: Variant) => variant.base_unit ?? units.find((unit) => unit.id === variant.base_unit_id) ?? null
  const options: StockProductOption[] = stockVariants.map((variant) => ({
    id: variant.id,
    label: `${template.name} · ${variantLabel(variant)}`,
    sku: variant.sku,
    unit: unitOf(variant),
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Stock por almacén</CardTitle>
            <CardDescription>Existencias y costo promedio. Cada ajuste queda registrado en el kardex.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {stockVariants[0] ? (
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href={`/inventory/movements?product_id=${stockVariants[0].id}`} />}
              >
                <ArrowLeftRightIcon /> Ver kardex
              </Button>
            ) : null}
            {canManage && canSeeWarehouses && stockVariants.length > 0 ? (
              <Button size="sm" onClick={() => setAdjusting({ productId: stockVariants[0].id, warehouseId: null })}>
                <SlidersHorizontalIcon /> Ajustar stock
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !data ? (
          <Skeleton className="h-24 w-full" />
        ) : (data?.stocks.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <BoxesIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">Sin stock registrado</p>
            <p className="text-sm text-muted-foreground">
              {canManage ? "Usa “Ajustar stock” con una entrada para cargar el inventario inicial." : "Todavía no hay existencias para este producto."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead>Presentación</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo promedio</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Actualizado</TableHead>
                {canManage && canSeeWarehouses ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.stocks.map((stock) => {
                const variant = stockVariants.find((item) => item.id === stock.product_id)
                const unit = variant ? unitOf(variant) : null
                return (
                  <TableRow key={stock.id}>
                    <TableCell>
                      {stock.warehouse?.store?.name ? `${stock.warehouse.store.name} · ` : ""}
                      {stock.warehouse?.name ?? `Almacén #${stock.warehouse_id}`}
                    </TableCell>
                    <TableCell>{variant ? variantLabel(variant) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatQuantity(stock.quantity, unit)}</TableCell>
                    <TableCell className="text-right">{formatMoney(stock.average_cost)}</TableCell>
                    <TableCell className="text-right">{formatMoney(stock.total_cost)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(stock.updated_at)}</TableCell>
                    {canManage && canSeeWarehouses ? (
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setAdjusting({ productId: stock.product_id, warehouseId: stock.warehouse_id })}>
                          Ajustar
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {derived.length > 0 ? (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">Presentaciones que descuentan del stock principal</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {derived.map((variant) => (
                <Badge key={variant.id} variant="outline">
                  {variantLabel(variant)} = {formatDecimal(variant.content_quantity, 3)} {unitShort(variant.content_unit ?? unitOf(variant))}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {canManage && !canSeeWarehouses ? (
          <p className="text-xs text-muted-foreground">Necesitas permiso para ver almacenes para registrar ajustes.</p>
        ) : null}
      </CardContent>

      <StockAdjustmentDialog
        open={adjusting !== null}
        onOpenChange={(open) => {
          if (!open) setAdjusting(null)
        }}
        products={options}
        warehouses={data?.warehouses ?? []}
        stocks={data?.stocks ?? []}
        initialProductId={adjusting?.productId ?? null}
        initialWarehouseId={adjusting?.warehouseId ?? null}
        onSaved={() => void reload()}
      />
    </Card>
  )
}
