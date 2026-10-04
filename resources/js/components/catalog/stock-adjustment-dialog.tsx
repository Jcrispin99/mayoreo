import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { SimpleSelect } from "@/components/catalog/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api, errorMessage } from "@/lib/api"
import { formatMoney, formatQuantity, isPositiveNumber, normalizeDecimal, unitShort } from "@/lib/catalog-format"
import { cn } from "@/lib/utils"
import type { StockRecord, Unit, Warehouse } from "@/types/catalog"

/** Producto que guarda stock propio (principal o presentación sin contenido). */
export type StockProductOption = {
  id: number
  label: string
  sku: string
  unit: Pick<Unit, "code"> | null
}

type StockAdjustmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: StockProductOption[]
  warehouses: Warehouse[]
  stocks?: StockRecord[]
  initialProductId?: number | null
  initialWarehouseId?: number | null
  onSaved: () => void
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  products,
  warehouses,
  stocks = [],
  initialProductId = null,
  initialWarehouseId = null,
  onSaved,
}: StockAdjustmentDialogProps) {
  const [productId, setProductId] = useState<number | null>(initialProductId)
  const [search, setSearch] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [direction, setDirection] = useState<"increase" | "decrease">("increase")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    const defaultWarehouse = warehouses.find((warehouse) => warehouse.is_default) ?? warehouses[0]
    setProductId(initialProductId ?? (products.length === 1 ? products[0].id : null))
    setSearch("")
    setWarehouseId(String(initialWarehouseId ?? defaultWarehouse?.id ?? ""))
    setDirection("increase")
    setQuantity("")
    setUnitCost("")
    setNotes("")
    setError("")
    setFieldErrors({})
    // Solo al abrir: las listas se recalculan en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Si los almacenes llegan después de abrir, propone el predeterminado.
  useEffect(() => {
    if (!open || warehouseId !== "" || warehouses.length === 0) return
    const defaultWarehouse = warehouses.find((warehouse) => warehouse.is_default) ?? warehouses[0]
    setWarehouseId(String(defaultWarehouse.id))
  }, [open, warehouseId, warehouses])

  const product = products.find((item) => item.id === productId) ?? null
  const currentStock = stocks.find(
    (stock) => stock.product_id === productId && String(stock.warehouse_id) === warehouseId,
  )
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    if (!term) return products.slice(0, 8)
    return products
      .filter((item) => `${item.label} ${item.sku}`.toLocaleLowerCase("es").includes(term))
      .slice(0, 8)
  }, [products, search])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!productId) errors.product_id = "Elige el producto."
    if (!warehouseId) errors.warehouse_id = "Elige el almacén."
    if (!isPositiveNumber(quantity)) errors.quantity = "Ingresa una cantidad mayor a cero."
    if (direction === "increase" && unitCost.trim() !== "" && !isPositiveNumber(unitCost)) {
      errors.unit_cost = "El costo debe ser mayor a cero."
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError("")
    try {
      await api.post("/stocks/adjust", {
        product_id: productId,
        warehouse_id: Number(warehouseId),
        direction,
        quantity: normalizeDecimal(quantity),
        unit_cost: direction === "increase" && unitCost.trim() ? normalizeDecimal(unitCost) : null,
        notes: notes.trim() || null,
      })
      onSaved()
      onOpenChange(false)
    } catch (requestError) {
      if (requestError instanceof ApiError && Object.keys(requestError.errors).length > 0) {
        setFieldErrors(Object.fromEntries(Object.entries(requestError.errors).map(([key, messages]) => [key, messages[0]])))
      }
      setError(errorMessage(requestError, "No se pudo registrar el ajuste."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            Usa una entrada para cargar el inventario inicial o sumar lo contado, y una salida para mermas o faltantes.
            Queda registrado en el kardex.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            {products.length > 1 || !product ? (
              <Field data-invalid={Boolean(fieldErrors.product_id)}>
                <FieldLabel>Producto</FieldLabel>
                {product ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{product.label}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{product.sku}</span>
                    </span>
                    {products.length > 1 ? (
                      <Button size="sm" type="button" variant="ghost" onClick={() => setProductId(null)}>
                        Cambiar
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        className="pl-8"
                        placeholder="Busca por nombre o SKU"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border">
                      {matches.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">Sin coincidencias.</p>
                      ) : (
                        matches.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                            onClick={() => setProductId(item.id)}
                          >
                            <span className="truncate">{item.label}</span>
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.sku}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <FieldError>{fieldErrors.product_id}</FieldError>
              </Field>
            ) : (
              <div className="rounded-lg border px-3 py-2">
                <p className="font-medium">{product.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
              </div>
            )}

            <Field data-invalid={Boolean(fieldErrors.warehouse_id)}>
              <FieldLabel>Almacén</FieldLabel>
              <SimpleSelect
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="Selecciona un almacén"
                invalid={Boolean(fieldErrors.warehouse_id)}
                options={warehouses.map((warehouse) => ({
                  value: String(warehouse.id),
                  label: `${warehouse.store?.name ? `${warehouse.store.name} · ` : ""}${warehouse.name}`,
                }))}
              />
              {product && warehouseId ? (
                <FieldDescription>
                  Stock actual: {formatQuantity(currentStock?.quantity ?? 0, product.unit)}
                  {currentStock ? ` · costo promedio ${formatMoney(currentStock.average_cost)}` : ""}
                </FieldDescription>
              ) : null}
              <FieldError>{fieldErrors.warehouse_id}</FieldError>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              {([
                ["increase", "Entrada", ArrowUpIcon],
                ["decrease", "Salida", ArrowDownIcon],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDirection(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    direction === value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(fieldErrors.quantity)}>
                <FieldLabel>Cantidad ({unitShort(product?.unit)})</FieldLabel>
                <Input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                  aria-invalid={Boolean(fieldErrors.quantity)}
                />
                <FieldError>{fieldErrors.quantity}</FieldError>
              </Field>
              {direction === "increase" ? (
                <Field data-invalid={Boolean(fieldErrors.unit_cost)}>
                  <FieldLabel>Costo por {unitShort(product?.unit)} (S/)</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={unitCost}
                    onChange={(event) => setUnitCost(event.target.value)}
                    placeholder={currentStock ? String(Number(currentStock.average_cost).toFixed(2)) : "0.00"}
                    aria-invalid={Boolean(fieldErrors.unit_cost)}
                  />
                  <FieldDescription>Vacío = costo promedio actual.</FieldDescription>
                  <FieldError>{fieldErrors.unit_cost}</FieldError>
                </Field>
              ) : null}
            </div>

            <Field>
              <FieldLabel>Motivo</FieldLabel>
              <Textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={direction === "increase" ? "Ej. Inventario inicial" : "Ej. Merma por humedad"}
              />
            </Field>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
