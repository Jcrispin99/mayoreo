import { PencilIcon, PlusIcon, TagIcon, Trash2Icon } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { ConfirmDialog } from "@/components/catalog/confirm-dialog"
import { SwitchField } from "@/components/catalog/switch-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError, api, errorMessage } from "@/lib/api"
import { formatDecimal, formatMoney, formatTierRange, normalizeDecimal, unitShort, variantLabel } from "@/lib/catalog-format"
import { cn } from "@/lib/utils"
import type { PriceTier, ProductTemplate, Unit, Variant } from "@/types/catalog"

const LABEL_SUGGESTIONS = ["Menudeo", "Por kilo", "Mayor", "Saco", "Precio por unidad", "Docena", "Caja"]

type ProductPriceTiersProps = {
  template: ProductTemplate
  units: Unit[]
  canManage: boolean
  onChanged: () => Promise<void>
}

export function ProductPriceTiers({ template, units, canManage, onChanged }: ProductPriceTiersProps) {
  const variants = useMemo(() => template.variants.filter((variant) => variant.is_active), [template])
  const [variantId, setVariantId] = useState<number | null>(variants[0]?.id ?? null)
  const [editing, setEditing] = useState<PriceTier | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleting, setDeleting] = useState<PriceTier | null>(null)

  useEffect(() => {
    if (!variants.some((variant) => variant.id === variantId)) setVariantId(variants[0]?.id ?? null)
  }, [variants, variantId])

  const variant = variants.find((item) => item.id === variantId) ?? null
  const unit = variant ? (variant.base_unit ?? units.find((item) => item.id === variant.base_unit_id) ?? null) : null
  const tiers = [...(variant?.price_tiers ?? [])].sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precios de venta</CardTitle>
        <CardDescription>
          Cada presentación tiene sus rangos. Al vender, el sistema elige el rango según la cantidad. Los rangos activos no pueden cruzarse.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {variants.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {variants.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setVariantId(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  item.id === variantId ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {variantLabel(item)}
                <span className="ml-1.5 text-xs opacity-70">({item.price_tiers?.length ?? 0})</span>
              </button>
            ))}
          </div>
        ) : null}

        {variant ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {variantLabel(variant)} · <span className="font-mono">{variant.sku}</span> · precios por {unitShort(unit)}
              </p>
              {canManage ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null)
                    setEditorOpen(true)
                  }}
                >
                  <PlusIcon /> Agregar rango
                </Button>
              ) : null}
            </div>

            {tiers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <TagIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">Aún no hay precios de venta</p>
                <p className="text-sm text-muted-foreground">
                  Agrega el primer rango para vender esta presentación (menudeo, por kilo, mayor, saco…).
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead className="text-right">Precio por {unitShort(unit)}</TableHead>
                    <TableHead>Estado</TableHead>
                    {canManage ? <TableHead className="w-24" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow key={tier.id} className={cn(!tier.is_active && "opacity-60")}>
                      <TableCell className="font-medium">{tier.label || "Sin nombre"}</TableCell>
                      <TableCell>{formatTierRange(tier, unit)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(tier.unit_price)}</TableCell>
                      <TableCell>
                        <Badge variant={tier.is_active ? "secondary" : "outline"}>{tier.is_active ? "Activo" : "Inactivo"}</Badge>
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              aria-label="Editar rango"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(tier)
                                setEditorOpen(true)
                              }}
                            >
                              <PencilIcon />
                            </Button>
                            <Button aria-label="Eliminar rango" size="icon-sm" variant="ghost" onClick={() => setDeleting(tier)}>
                              <Trash2Icon />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <PriceTierDialog
              open={editorOpen}
              onOpenChange={setEditorOpen}
              variant={variant}
              unit={unit}
              tier={editing}
              onSaved={onChanged}
            />
            <ConfirmDialog
              open={deleting !== null}
              onOpenChange={(open) => {
                if (!open) setDeleting(null)
              }}
              title="¿Eliminar este rango de precio?"
              description="Las ventas ya registradas no cambian. Esta acción no se puede deshacer."
              onConfirm={async () => {
                if (!deleting) return
                await api.delete(`/price-tiers/${deleting.id}`)
                await onChanged()
              }}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Este producto no tiene presentaciones activas.</p>
        )}
      </CardContent>
    </Card>
  )
}

type PriceTierDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: Variant
  unit: Pick<Unit, "code"> | null
  tier: PriceTier | null
  onSaved: () => Promise<void>
}

function PriceTierDialog({ open, onOpenChange, variant, unit, tier, onSaved }: PriceTierDialogProps) {
  const [label, setLabel] = useState("")
  const [minQuantity, setMinQuantity] = useState("0")
  const [maxQuantity, setMaxQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setLabel(tier?.label ?? "")
    setMinQuantity(tier ? formatDecimal(tier.min_quantity) : variant.sale_mode === "unit" ? "1" : "0")
    setMaxQuantity(tier?.max_quantity == null ? "" : formatDecimal(tier.max_quantity))
    setUnitPrice(tier ? Number(tier.unit_price).toFixed(2) : "")
    setIsActive(tier?.is_active ?? true)
    setError("")
    setErrors({})
  }, [open, tier, variant])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const min = Number(normalizeDecimal(minQuantity))
    const max = maxQuantity.trim() ? Number(normalizeDecimal(maxQuantity)) : null
    const price = Number(normalizeDecimal(unitPrice))
    const nextErrors: Record<string, string> = {}
    if (minQuantity.trim() === "" || !Number.isFinite(min) || min < 0) nextErrors.min_quantity = "Cantidad mínima no válida."
    if (max !== null && (!Number.isFinite(max) || max <= min)) nextErrors.max_quantity = "Debe ser mayor que la cantidad mínima."
    if (!Number.isFinite(price) || price <= 0) nextErrors.unit_price = "Ingresa un precio mayor a cero."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setError("")
    try {
      const payload = {
        label: label.trim() || null,
        min_quantity: normalizeDecimal(minQuantity),
        max_quantity: maxQuantity.trim() ? normalizeDecimal(maxQuantity) : null,
        unit_price: normalizeDecimal(unitPrice),
        is_active: isActive,
      }
      if (tier) await api.put(`/price-tiers/${tier.id}`, payload)
      else await api.post(`/products/${variant.id}/price-tiers`, payload)
      await onSaved()
      onOpenChange(false)
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(requestError.errors).map(([key, messages]) => [key, messages[0]])))
      }
      setError(errorMessage(requestError, "No se pudo guardar el precio."))
    } finally {
      setSaving(false)
    }
  }

  const unitCode = unitShort(unit)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tier ? "Editar rango de precio" : "Nuevo rango de precio"}</DialogTitle>
          <DialogDescription>
            {variantLabel(variant)} · cantidades en {unitCode}. Deja “hasta” vacío para no poner límite.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre del rango</FieldLabel>
              <Input list="price-tier-labels" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ej. Menudeo, Por kilo, Mayor" />
              <datalist id="price-tier-labels">
                {LABEL_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(errors.min_quantity)}>
                <FieldLabel>Desde ({unitCode})</FieldLabel>
                <Input inputMode="decimal" value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)} aria-invalid={Boolean(errors.min_quantity)} />
                <FieldError>{errors.min_quantity}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.max_quantity)}>
                <FieldLabel>Hasta ({unitCode})</FieldLabel>
                <Input inputMode="decimal" value={maxQuantity} onChange={(event) => setMaxQuantity(event.target.value)} placeholder="Sin límite" aria-invalid={Boolean(errors.max_quantity)} />
                <FieldError>{errors.max_quantity}</FieldError>
              </Field>
            </div>
            {unitCode === "kg" ? (
              <FieldDescription>
                Para “menos de 1 kg” usa desde 0 hasta 0.999999; el siguiente rango empieza en 1.
              </FieldDescription>
            ) : null}
            <Field data-invalid={Boolean(errors.unit_price)}>
              <FieldLabel>Precio por {unitCode} (S/)</FieldLabel>
              <Input inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.unit_price)} />
              <FieldError>{errors.unit_price}</FieldError>
            </Field>
            <SwitchField
              label="Precio activo"
              description="Se aplica automáticamente al registrar ventas."
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <p className="text-xs text-muted-foreground">
              Al guardar, la app avisa a los vendedores del cambio de precio y lo resalta en el POS.
            </p>
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
              {saving ? "Guardando…" : "Guardar precio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
