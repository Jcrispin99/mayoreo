import { PencilIcon, PlusIcon, ShoppingCartIcon, Trash2Icon } from "lucide-react"
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
import { isPositiveNumber, normalizeDecimal, unitShort, variantLabel, formatDecimal } from "@/lib/catalog-format"
import { cn } from "@/lib/utils"
import type { ProductTemplate, PurchaseUnit, Unit, Variant } from "@/types/catalog"

type ProductPurchaseUnitsProps = {
  template: ProductTemplate
  units: Unit[]
  canManage: boolean
  onChanged: () => Promise<void>
}

function purchaseBaseLabel(variant: Variant, unit: Pick<Unit, "code"> | null) {
  return variant.is_principal ? unitShort(unit) : variantLabel(variant)
}

export function ProductPurchaseUnits({ template, units, canManage, onChanged }: ProductPurchaseUnitsProps) {
  const variants = useMemo(() => template.variants.filter((variant) => variant.is_active), [template])
  const [variantId, setVariantId] = useState<number | null>(variants[0]?.id ?? null)
  const [editing, setEditing] = useState<PurchaseUnit | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleting, setDeleting] = useState<PurchaseUnit | null>(null)

  useEffect(() => {
    if (!variants.some((variant) => variant.id === variantId)) setVariantId(variants[0]?.id ?? null)
  }, [variants, variantId])

  const variant = variants.find((item) => item.id === variantId) ?? null
  const unit = variant ? (variant.base_unit ?? units.find((item) => item.id === variant.base_unit_id) ?? null) : null
  const purchaseUnits = variant?.purchase_units ?? []
  const baseLabel = variant ? purchaseBaseLabel(variant, unit) : "unidad base"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unidades de compra</CardTitle>
        <CardDescription>
          Cómo llega el producto del proveedor (saco, caja, fardo) y a cuánto equivale en la unidad de venta. Se usa al registrar compras.
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
              </button>
            ))}
          </div>
        ) : null}

        {variant ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {variantLabel(variant)} · <span className="font-mono">{variant.sku}</span>
              </p>
              {canManage ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null)
                    setEditorOpen(true)
                  }}
                >
                  <PlusIcon /> Agregar unidad de compra
                </Button>
              ) : null}
            </div>

            {purchaseUnits.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <ShoppingCartIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">Sin unidades de compra</p>
                <p className="text-sm text-muted-foreground">
                  Ej. “Caja x12” equivale a 12 {baseLabel}. Sin esta configuración, las compras se registran directamente en {baseLabel}.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Equivale a</TableHead>
                    <TableHead>Código de barras</TableHead>
                    <TableHead />
                    {canManage ? <TableHead className="w-24" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseUnits.map((purchaseUnit) => (
                    <TableRow key={purchaseUnit.id}>
                      <TableCell className="font-medium">{purchaseUnit.name}</TableCell>
                      <TableCell className="text-right">{formatDecimal(purchaseUnit.conversion_factor)} {baseLabel}</TableCell>
                      <TableCell className="font-mono text-xs">{purchaseUnit.barcode ?? "—"}</TableCell>
                      <TableCell>{purchaseUnit.is_default_purchase ? <Badge>Predeterminada</Badge> : null}</TableCell>
                      {canManage ? (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              aria-label="Editar unidad de compra"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(purchaseUnit)
                                setEditorOpen(true)
                              }}
                            >
                              <PencilIcon />
                            </Button>
                            <Button aria-label="Eliminar unidad de compra" size="icon-sm" variant="ghost" onClick={() => setDeleting(purchaseUnit)}>
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

            <PurchaseUnitDialog
              open={editorOpen}
              onOpenChange={setEditorOpen}
              variant={variant}
              unit={unit}
              purchaseUnit={editing}
              onSaved={onChanged}
            />
            <ConfirmDialog
              open={deleting !== null}
              onOpenChange={(open) => {
                if (!open) setDeleting(null)
              }}
              title="¿Eliminar esta unidad de compra?"
              description="Las compras ya registradas no cambian."
              onConfirm={async () => {
                if (!deleting) return
                await api.delete(`/purchase-units/${deleting.id}`)
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

type PurchaseUnitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: Variant
  unit: Pick<Unit, "code"> | null
  purchaseUnit: PurchaseUnit | null
  onSaved: () => Promise<void>
}

function PurchaseUnitDialog({ open, onOpenChange, variant, unit, purchaseUnit, onSaved }: PurchaseUnitDialogProps) {
  const [name, setName] = useState("")
  const [factor, setFactor] = useState("")
  const [barcode, setBarcode] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(purchaseUnit?.name ?? "")
    setFactor(purchaseUnit ? formatDecimal(purchaseUnit.conversion_factor) : "")
    setBarcode(purchaseUnit?.barcode ?? "")
    setIsDefault(purchaseUnit?.is_default_purchase ?? (variant.purchase_units?.length ?? 0) === 0)
    setError("")
    setErrors({})
  }, [open, purchaseUnit, variant])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = "Ingresa un nombre."
    if (!isPositiveNumber(factor)) nextErrors.conversion_factor = "Ingresa una equivalencia mayor a cero."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        conversion_factor: normalizeDecimal(factor),
        barcode: barcode.trim() || null,
        is_default_purchase: isDefault,
      }
      const saved = purchaseUnit
        ? await api.put<PurchaseUnit>(`/purchase-units/${purchaseUnit.id}`, payload)
        : await api.post<PurchaseUnit>(`/products/${variant.id}/purchase-units`, payload)

      // Solo una unidad predeterminada por presentación.
      if (isDefault) {
        const others = (variant.purchase_units ?? []).filter((item) => item.id !== saved.id && item.is_default_purchase)
        await Promise.all(others.map((item) => api.put(`/purchase-units/${item.id}`, { is_default_purchase: false })))
      }
      await onSaved()
      onOpenChange(false)
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(requestError.errors).map(([key, messages]) => [key, messages[0]])))
      }
      setError(errorMessage(requestError, "No se pudo guardar la unidad de compra."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{purchaseUnit ? "Editar unidad de compra" : "Nueva unidad de compra"}</DialogTitle>
          <DialogDescription>{variantLabel(variant)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Saco 50 kg" aria-invalid={Boolean(errors.name)} />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.conversion_factor)}>
              <FieldLabel>Equivale a ({purchaseBaseLabel(variant, unit)})</FieldLabel>
              <Input inputMode="decimal" value={factor} onChange={(event) => setFactor(event.target.value)} placeholder="50" aria-invalid={Boolean(errors.conversion_factor)} />
              <FieldDescription>Cuántas unidades de “{purchaseBaseLabel(variant, unit)}” contiene cada empaque del proveedor.</FieldDescription>
              <FieldError>{errors.conversion_factor}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Código de barras</FieldLabel>
              <Input value={barcode} onChange={(event) => setBarcode(event.target.value)} />
            </Field>
            <SwitchField
              label="Unidad predeterminada"
              description="Se propone primero al registrar compras."
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
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
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
