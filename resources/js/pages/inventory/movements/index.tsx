import { Head, router } from "@inertiajs/react"
import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { PageHeading } from "@/components/catalog/page-heading"
import { Pager, paginate } from "@/components/catalog/pager"
import { SimpleSelect } from "@/components/catalog/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import type { InventoryMovement, MovementType, Warehouse } from "@/types/catalog"

const PAGE_SIZE = 50

const TYPE_LABELS: Record<MovementType, string> = {
  purchase: "Compra",
  transfer_in: "Traslado recibido",
  transfer_out: "Traslado enviado",
  sale: "Venta",
  adjustment: "Ajuste",
}

function initialProductId(): string {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("product_id") ?? ""
}

export default function MovementsIndex() {
  const can = useCan()
  const [productId, setProductId] = useState(initialProductId)
  const [warehouseId, setWarehouseId] = useState("all")
  const [flow, setFlow] = useState<"all" | "in" | "out">("all")
  const [type, setType] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const { data: warehouses } = useApi(
    () => (can("warehouses.view") ? api.get<Warehouse[]>("/warehouses") : Promise.resolve([] as Warehouse[])),
    [],
  )

  const { data: movements, loading, error, reload } = useApi(
    () => api.get<InventoryMovement[]>("/inventory-movements", {
      product_id: productId || null,
      warehouse_id: warehouseId === "all" ? null : warehouseId,
      flow: flow === "all" ? null : flow,
      type: type === "all" ? null : type,
    }),
    [productId, warehouseId, flow, type],
    "No se pudo cargar el kardex.",
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    if (!term) return movements ?? []
    return (movements ?? []).filter((movement) =>
      `${movement.product?.name ?? ""} ${movement.product?.sku ?? ""} ${movement.notes ?? ""}`.toLocaleLowerCase("es").includes(term),
    )
  }, [movements, search])

  const productName = productId ? movements?.[0]?.product?.name : null

  function clearProduct() {
    setProductId("")
    setPage(1)
    router.replace({ url: "/inventory/movements", preserveState: true, preserveScroll: true })
  }

  return (
    <AppLayout title="Kardex">
      <Head title="Kardex" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeading
          eyebrow="Inventario"
          title="Kardex"
          description="Entradas y salidas de inventario con su saldo y costo promedio después de cada movimiento."
          actions={
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              <RefreshCwIcon className={cn(loading && "animate-spin")} /> Actualizar
            </Button>
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
              <div className="inline-flex rounded-lg border p-0.5">
                {([
                  ["all", "Todos"],
                  ["in", "Entradas"],
                  ["out", "Salidas"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFlow(value)
                      setPage(1)
                    }}
                    className={cn(
                      "rounded-md px-3 py-1 text-sm transition-colors",
                      flow === value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <SimpleSelect
                className="w-48"
                value={type}
                onChange={(value) => {
                  setType(value)
                  setPage(1)
                }}
                options={[
                  { value: "all", label: "Todos los tipos" },
                  ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              {(warehouses?.length ?? 0) > 0 ? (
                <SimpleSelect
                  className="w-56"
                  value={warehouseId}
                  onChange={(value) => {
                    setWarehouseId(value)
                    setPage(1)
                  }}
                  options={[
                    { value: "all", label: "Todos los almacenes" },
                    ...(warehouses ?? []).map((warehouse) => ({ value: String(warehouse.id), label: warehouse.name })),
                  ]}
                />
              ) : null}
              <div className="relative min-w-48 flex-1">
                <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar producto, SKU o nota"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>

            {productId ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Producto:</span>
                <Badge variant="secondary">{productName ?? `#${productId}`}</Badge>
                <Button size="xs" variant="ghost" onClick={clearProduct}>
                  <XIcon /> Ver todos
                </Button>
              </div>
            ) : null}

            {loading && !movements ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ArrowLeftRightIcon className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Sin movimientos</p>
                  <p className="text-sm text-muted-foreground">
                    Los movimientos aparecen al confirmar compras, registrar ventas, traslados o ajustes.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Movimiento</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo unit.</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Costo prom.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginate(filtered, page, PAGE_SIZE).map((movement) => {
                      const unit = movement.product?.base_unit ?? null
                      const incoming = movement.flow === "in"
                      return (
                        <TableRow key={movement.id}>
                          <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(movement.created_at)}</TableCell>
                          <TableCell>
                            <span className="block max-w-56 truncate font-medium">{movement.product?.name}</span>
                            <span className="block font-mono text-xs text-muted-foreground">{movement.product?.sku}</span>
                            {movement.notes ? <span className="block max-w-56 truncate text-xs text-muted-foreground">{movement.notes}</span> : null}
                          </TableCell>
                          <TableCell>{movement.warehouse?.name}</TableCell>
                          <TableCell>
                            <span className={cn("inline-flex items-center gap-1 text-sm", incoming ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                              {incoming ? <ArrowDownLeftIcon className="size-4" /> : <ArrowUpRightIcon className="size-4" />}
                              {TYPE_LABELS[movement.type] ?? movement.type}
                            </span>
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", incoming ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                            {incoming ? "+" : "−"}{formatQuantity(movement.quantity, unit)}
                          </TableCell>
                          <TableCell className="text-right">{movement.unit_cost !== null ? formatMoney(movement.unit_cost) : "—"}</TableCell>
                          <TableCell className="text-right">{formatQuantity(movement.balance_quantity, unit)}</TableCell>
                          <TableCell className="text-right">{formatMoney(movement.balance_unit_cost)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
