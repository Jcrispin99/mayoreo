import { Head, Link, router } from "@inertiajs/react"
import {
  BadgeDollarSignIcon,
  ChevronRightIcon,
  ImageIcon,
  PackageCheckIcon,
  PackageIcon,
  PackageXIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

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
import { basePrice, formatMoney, formatQuantity, unitShort } from "@/lib/catalog-format"
import { cn } from "@/lib/utils"
import type { ProductTemplate, StockRecord } from "@/types/catalog"

const PAGE_SIZE = 50

type StatusFilter = "active" | "inactive" | "all"
type GapFilter = "all" | "no-price" | "no-stock"

type Row = {
  template: ProductTemplate
  unit: { code: string } | null
  priceLabel: string | null
  stock: number
  hasPrice: boolean
  presentations: number
  searchText: string
}

export default function ProductsIndex() {
  const can = useCan()
  const canSeeStock = can("stock.view")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("active")
  const [gap, setGap] = useState<GapFilter>("all")
  const [page, setPage] = useState(1)

  const { data, loading, error, reload } = useApi(async () => {
    const [templates, stocks] = await Promise.all([
      api.get<ProductTemplate[]>("/product-templates"),
      canSeeStock ? api.get<StockRecord[]>("/stocks") : Promise.resolve([] as StockRecord[]),
    ])
    return { templates, stocks }
  }, [canSeeStock], "No se pudieron cargar los productos.")

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const stockByProduct = new Map<number, number>()
    data.stocks.forEach((stock) => {
      stockByProduct.set(stock.product_id, (stockByProduct.get(stock.product_id) ?? 0) + Number(stock.quantity))
    })

    return data.templates.map((template) => {
      const principal = template.variants.find((variant) => variant.is_principal) ?? template.variants[0]
      const tier = principal ? basePrice(principal) : null
      const activeVariants = template.variants.filter((variant) => variant.is_active)
      const unit = principal?.base_unit ?? null

      return {
        template,
        unit,
        priceLabel: tier ? `${formatMoney(tier.unit_price)} / ${unitShort(unit)}` : null,
        hasPrice: activeVariants.some((variant) => basePrice(variant) !== null),
        stock: principal ? stockByProduct.get(principal.id) ?? 0 : 0,
        presentations: activeVariants.length,
        searchText: [
          template.name,
          ...template.variants.flatMap((variant) => [variant.sku, variant.barcode ?? "", variant.variant_name ?? ""]),
        ].join(" ").toLocaleLowerCase("es"),
      }
    })
  }, [data])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    return rows.filter((row) => {
      if (status === "active" && !row.template.is_active) return false
      if (status === "inactive" && row.template.is_active) return false
      if (gap === "no-price" && row.hasPrice) return false
      if (gap === "no-stock" && row.stock > 0) return false
      return term === "" || row.searchText.includes(term)
    })
  }, [rows, search, status, gap])

  const activeRows = rows.filter((row) => row.template.is_active)
  const withoutPrice = activeRows.filter((row) => !row.hasPrice).length
  const withoutStock = activeRows.filter((row) => row.stock <= 0).length

  function changeFilter(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <AppLayout title="Productos">
      <Head title="Productos" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <PageHeading
          eyebrow="Catálogo"
          title="Productos"
          description="Administra productos, variantes, precios y existencias desde un solo lugar."
          actions={
            <>
              <Button variant="outline" onClick={() => void reload()} disabled={loading}>
                <RefreshCwIcon className={cn(loading && "animate-spin")} /> Actualizar
              </Button>
              {can("products.manage") ? (
                <Button nativeButton={false} render={<Link href="/catalog/products/create" />}>
                  <PlusIcon /> Nuevo producto
                </Button>
              ) : null}
            </>
          }
        />

        <div className={cn("grid gap-3", canSeeStock ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <SummaryTile icon={<PackageCheckIcon />} label="Productos activos" value={activeRows.length} active={gap === "all"} onClick={() => changeFilter(() => setGap("all"))} />
          <SummaryTile icon={<BadgeDollarSignIcon />} label="Sin precio de venta" value={withoutPrice} tone={withoutPrice > 0 ? "warning" : undefined} active={gap === "no-price"} onClick={() => changeFilter(() => setGap("no-price"))} />
          {canSeeStock ? (
            <SummaryTile icon={<PackageXIcon />} label="Sin stock" value={withoutStock} tone={withoutStock > 0 ? "warning" : undefined} active={gap === "no-stock"} onClick={() => changeFilter(() => setGap("no-stock"))} />
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-0 px-0">
            <div className="flex flex-wrap items-center gap-2 border-b p-4">
              <div className="relative min-w-56 flex-1">
                <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nombre, SKU o código de barras"
                  value={search}
                  onChange={(event) => changeFilter(() => setSearch(event.target.value))}
                />
              </div>
              <SimpleSelect
                className="w-40"
                value={status}
                onChange={(value) => changeFilter(() => setStatus(value as StatusFilter))}
                options={[
                  { value: "active", label: "Activos" },
                  { value: "inactive", label: "Inactivos" },
                  { value: "all", label: "Todos" },
                ]}
              />
            </div>

            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <PackageIcon className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">{rows.length === 0 ? "Todavía no hay productos" : "Sin resultados"}</p>
                  <p className="text-sm text-muted-foreground">
                    {rows.length === 0 ? "Crea el primer producto para empezar a vender." : "Cambia la búsqueda o los filtros."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Variantes</TableHead>
                      <TableHead className="text-right">Precio base</TableHead>
                      {canSeeStock ? <TableHead className="text-right">Stock</TableHead> : null}
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginate(filtered, page, PAGE_SIZE).map((row) => {
                      const principal = row.template.variants.find((variant) => variant.is_principal)
                      return (
                        <TableRow
                          key={row.template.id}
                          className="cursor-pointer"
                          onClick={() => router.visit(`/catalog/products/${row.template.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {row.template.image_url ? (
                                <img alt="" src={row.template.image_url} className="size-9 shrink-0 rounded-md object-cover" />
                              ) : (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                                  <ImageIcon className="size-4 text-muted-foreground" />
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block max-w-72 truncate font-medium">{row.template.name}</span>
                                <span className="block font-mono text-xs text-muted-foreground">{principal?.sku}</span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{row.unit?.code === "kg" ? "Kilogramo" : "Unidad"}</TableCell>
                          <TableCell className="text-right">{Math.max(row.presentations - 1, 0)}</TableCell>
                          <TableCell className="text-right">
                            {row.priceLabel ?? <span className="text-amber-600 dark:text-amber-400">Sin precio</span>}
                          </TableCell>
                          {canSeeStock ? (
                            <TableCell className={cn("text-right", row.stock <= 0 && "text-muted-foreground")}>
                              {formatQuantity(row.stock, row.unit)}
                            </TableCell>
                          ) : null}
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={row.template.is_active ? "secondary" : "outline"}>
                                {row.template.is_active ? "Activo" : "Inactivo"}
                              </Badge>
                              {!row.template.is_pos_visible ? <Badge variant="outline">Oculto en POS</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChevronRightIcon className="size-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div className="border-t px-4 py-3">
                  <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: number
  tone?: "warning"
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm",
        active && "border-primary/60 bg-primary/5 ring-1 ring-primary/20",
      )}
    >
      <span className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors [&_svg]:size-5",
        active && "bg-primary text-primary-foreground",
        tone === "warning" && value > 0 && !active && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className={cn("block text-2xl font-semibold leading-tight tabular-nums", tone === "warning" && value > 0 && "text-amber-700 dark:text-amber-400")}>{value}</span>
      </span>
    </button>
  )
}
