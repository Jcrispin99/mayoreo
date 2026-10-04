import { Head, Link } from "@inertiajs/react"
import { BoxesIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { PageHeading } from "@/components/catalog/page-heading"
import { Pager, paginate } from "@/components/catalog/pager"
import { SimpleSelect } from "@/components/catalog/simple-select"
import { StockAdjustmentDialog, type StockProductOption } from "@/components/catalog/stock-adjustment-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { useCan } from "@/hooks/use-can"
import { AppLayout } from "@/layouts/app-layout"
import { api } from "@/lib/api"
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/catalog-format"
import { cn } from "@/lib/utils"
import type { StockRecord, Unit, Variant, Warehouse } from "@/types/catalog"

const PAGE_SIZE = 50

export default function StockIndex() {
  const can = useCan()
  const canAdjust = can("stock.manage") && can("warehouses.view")
  const [warehouseId, setWarehouseId] = useState("all")
  const [search, setSearch] = useState("")
  const [onlyWithStock, setOnlyWithStock] = useState(true)
  const [page, setPage] = useState(1)
  const [adjusting, setAdjusting] = useState<{ productId: number | null; warehouseId: number | null } | null>(null)

  const { data, loading, error, reload } = useApi(async () => {
    const [stocks, units, warehouses, products] = await Promise.all([
      api.get<StockRecord[]>("/stocks"),
      api.get<Unit[]>("/units-of-measure"),
      can("warehouses.view") ? api.get<Warehouse[]>("/warehouses") : Promise.resolve([] as Warehouse[]),
      canAdjust ? api.get<Variant[]>("/products", { is_active: true }) : Promise.resolve([] as Variant[]),
    ])
    return { stocks, units, warehouses, products }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [], "No se pudo cargar el stock.")

  const unitById = useMemo(() => new Map((data?.units ?? []).map((unit) => [unit.id, unit])), [data])
  const warehouseById = useMemo(() => new Map((data?.warehouses ?? []).map((warehouse) => [warehouse.id, warehouse])), [data])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    return (data?.stocks ?? [])
      .filter((stock) => warehouseId === "all" || String(stock.warehouse_id) === warehouseId)
      .filter((stock) => !onlyWithStock || Number(stock.quantity) !== 0)
      .filter((stock) => term === "" || `${stock.product?.name ?? ""} ${stock.product?.sku ?? ""}`.toLocaleLowerCase("es").includes(term))
      .sort((first, second) => (first.product?.name ?? "").localeCompare(second.product?.name ?? "", "es"))
  }, [data, warehouseId, onlyWithStock, search])

  const totalValue = filtered.reduce((total, stock) => total + Number(stock.total_cost), 0)

  // Solo se ajusta la presentación que guarda stock: la principal o una sin contenido.
  const productOptions: StockProductOption[] = useMemo(() => (data?.products ?? [])
    .filter((product) => product.is_principal || product.content_quantity === null)
    .map((product) => ({
      id: product.id,
      label: product.display_name || product.name,
      sku: product.sku,
      unit: product.base_unit ?? unitById.get(product.base_unit_id) ?? null,
    })), [data, unitById])

  const activeWarehouses = (data?.warehouses ?? []).filter((warehouse) => warehouse.is_active)

  return (
    <AppLayout title="Stock">
      <Head title="Stock" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeading
          eyebrow="Inventario"
          title="Stock por almacén"
          description="Existencias actuales y su valor a costo promedio."
          actions={
            <>
              <Button variant="outline" onClick={() => void reload()} disabled={loading}>
                <RefreshCwIcon className={cn(loading && "animate-spin")} /> Actualizar
              </Button>
              {canAdjust ? (
                <Button onClick={() => setAdjusting({ productId: null, warehouseId: warehouseId === "all" ? null : Number(warehouseId) })}>
                  <PlusIcon /> Ajuste o carga inicial
                </Button>
              ) : null}
            </>
          }
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar producto o SKU"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
              {(data?.warehouses.length ?? 0) > 0 ? (
                <SimpleSelect
                  className="w-56"
                  value={warehouseId}
                  onChange={(value) => {
                    setWarehouseId(value)
                    setPage(1)
                  }}
                  options={[
                    { value: "all", label: "Todos los almacenes" },
                    ...(data?.warehouses ?? []).map((warehouse) => ({
                      value: String(warehouse.id),
                      label: `${warehouse.store?.name ? `${warehouse.store.name} · ` : ""}${warehouse.name}`,
                    })),
                  ]}
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={onlyWithStock}
                  onChange={(event) => {
                    setOnlyWithStock(event.target.checked)
                    setPage(1)
                  }}
                />
                Ocultar en cero
              </label>
            </div>

            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <BoxesIcon className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">{(data?.stocks.length ?? 0) === 0 ? "Todavía no hay stock registrado" : "Sin resultados"}</p>
                  <p className="text-sm text-muted-foreground">
                    {(data?.stocks.length ?? 0) === 0
                      ? "Registra una entrada con “Ajuste o carga inicial”, o confirma una compra."
                      : "Cambia la búsqueda o los filtros."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo promedio</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Actualizado</TableHead>
                      {canAdjust ? <TableHead /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginate(filtered, page, PAGE_SIZE).map((stock) => {
                      const unit = stock.product ? unitById.get(stock.product.base_unit_id) ?? null : null
                      const warehouse = stock.warehouse ?? warehouseById.get(stock.warehouse_id)
                      return (
                        <TableRow key={stock.id}>
                          <TableCell>
                            {stock.product?.product_template_id ? (
                              <Link className="font-medium hover:underline" href={`/catalog/products/${stock.product.product_template_id}`}>
                                {stock.product.name}
                              </Link>
                            ) : (
                              <span className="font-medium">{stock.product?.name ?? `Producto #${stock.product_id}`}</span>
                            )}
                            <span className="block font-mono text-xs text-muted-foreground">{stock.product?.sku}</span>
                          </TableCell>
                          <TableCell>{warehouse?.name ?? `Almacén #${stock.warehouse_id}`}</TableCell>
                          <TableCell className={cn("text-right font-medium", Number(stock.quantity) < 0 && "text-destructive")}>
                            {formatQuantity(stock.quantity, unit)}
                          </TableCell>
                          <TableCell className="text-right">{formatMoney(stock.average_cost)}</TableCell>
                          <TableCell className="text-right">{formatMoney(stock.total_cost)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateTime(stock.updated_at)}</TableCell>
                          {canAdjust ? (
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
                <div className="flex justify-end text-sm">
                  <span className="text-muted-foreground">Valor del inventario mostrado:&nbsp;</span>
                  <span className="font-semibold">{formatMoney(totalValue)}</span>
                </div>
                <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {canAdjust ? (
        <StockAdjustmentDialog
          open={adjusting !== null}
          onOpenChange={(open) => {
            if (!open) setAdjusting(null)
          }}
          products={productOptions}
          warehouses={activeWarehouses}
          stocks={data?.stocks ?? []}
          initialProductId={adjusting?.productId ?? null}
          initialWarehouseId={adjusting?.warehouseId ?? null}
          onSaved={() => void reload()}
        />
      ) : null}
    </AppLayout>
  )
}
