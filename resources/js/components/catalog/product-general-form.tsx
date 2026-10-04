import { router } from "@inertiajs/react"
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { ConfirmDialog } from "@/components/catalog/confirm-dialog"
import { SimpleSelect } from "@/components/catalog/simple-select"
import { SwitchField } from "@/components/catalog/switch-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api, errorMessage } from "@/lib/api"
import { slug } from "@/lib/catalog-format"
import { attributesPayload, variantPayload, type VariantPayload } from "@/lib/product-template-payload"
import type { ProductTemplate, Unit, Variant } from "@/types/catalog"

type ProductGeneralFormProps = {
  template: ProductTemplate | null
  units: Unit[]
  canManage: boolean
  onSaved: (template: ProductTemplate) => void
}

export function ProductGeneralForm({ template, units, canManage, onSaved }: ProductGeneralFormProps) {
  const principal = template?.variants.find((variant) => variant.is_principal) ?? template?.variants[0] ?? null
  const defaultUnit = units.find((unit) => unit.code === "NIU") ?? units[0]

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [unitId, setUnitId] = useState("")
  const [sku, setSku] = useState("")
  const [barcode, setBarcode] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [posVisible, setPosVisible] = useState(true)
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    setName(template?.name ?? "")
    setDescription(template?.description ?? "")
    setUnitId(String(principal?.base_unit_id ?? defaultUnit?.id ?? ""))
    setSku(principal?.sku ?? "")
    setBarcode(principal?.barcode ?? "")
    setIsActive(template?.is_active ?? true)
    setPosVisible(template?.is_pos_visible ?? true)
    setImage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, units])

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const selectedUnit = units.find((unit) => String(unit.id) === unitId)
  const imageUrl = preview ?? template?.image_url ?? null

  function principalPayload(current: Variant | null): VariantPayload {
    const saleMode = selectedUnit?.code === "kg" ? "measured" : "unit"
    const previousName = current?.variant_name ?? null
    return {
      ...(current ? variantPayload(current) : {
        is_favorite: false,
        attribute_values: [],
        content_quantity: null,
        content_unit_id: null,
      }),
      id: current?.id,
      variant_name: saleMode === "measured" ? "Kilogramos" : previousName === "Kilogramos" ? null : previousName,
      sku: sku.trim() || slug(name) || "PRODUCTO",
      barcode: barcode.trim() || null,
      base_unit_id: selectedUnit?.id ?? null,
      sale_mode: saleMode,
      content_quantity: null,
      content_unit_id: null,
      is_active: true,
      is_principal: true,
      attribute_values: [],
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setErrors({ name: "Ingresa el nombre del producto." })
      return
    }
    if (!selectedUnit) {
      setErrors({ base_unit_id: "Elige la unidad de medida." })
      return
    }

    setSaving(true)
    setError("")
    setErrors({})
    setSaved(false)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
        is_pos_visible: posVisible,
        attributes: template ? attributesPayload(template) : [],
        variants: template
          ? template.variants.map((variant) => (variant.is_principal ? principalPayload(variant) : variantPayload(variant)))
          : [principalPayload(null)],
      }
      let result = template
        ? await api.put<ProductTemplate>(`/product-templates/${template.id}`, payload)
        : await api.post<ProductTemplate>("/product-templates", payload)

      const savedPrincipal = result.variants.find((variant) => variant.is_principal)
      if (image && savedPrincipal) {
        const formData = new FormData()
        formData.append("image", image)
        await api.post(`/products/${savedPrincipal.id}/image`, formData)
        result = await api.get<ProductTemplate>(`/product-templates/${result.id}`)
      }

      if (!template) {
        router.visit(`/catalog/products/${result.id}?tab=variants`)
        return
      }
      onSaved(result)
      setSaved(true)
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        const mapped: Record<string, string> = {}
        Object.entries(requestError.errors).forEach(([key, messages]) => {
          if (key === "name" || key === "description") mapped[key] = messages[0]
          else if (key.endsWith(".sku")) mapped.sku = messages[0]
          else if (key.endsWith(".barcode")) mapped.barcode = messages[0]
          else if (key.endsWith(".base_unit_id") || key.endsWith(".sale_mode")) mapped.base_unit_id = messages[0]
        })
        setErrors(mapped)
      }
      setError(errorMessage(requestError, "No se pudo guardar el producto."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información general</CardTitle>
        <CardDescription>
          {template
            ? "Datos del producto y de su presentación principal."
            : "Crea el producto principal. Al guardar irás directamente a configurar sus variantes."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <div className="grid gap-6 md:grid-cols-[160px_1fr]">
              <div className="flex flex-col items-center gap-2">
                <label className="group relative flex size-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted">
                  {imageUrl ? (
                    <img alt="" src={imageUrl} className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-10 text-muted-foreground" />
                  )}
                  {canManage ? (
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <UploadIcon className="size-3.5" /> Cambiar foto
                    </span>
                  ) : null}
                  <input
                    accept="image/*"
                    className="sr-only"
                    disabled={!canManage}
                    type="file"
                    onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="text-center text-xs text-muted-foreground">
                  {image ? "La foto se sube al guardar." : "JPG o PNG, máximo 4 MB."}
                </p>
              </div>

              <div className="grid gap-4">
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel>Nombre del producto</FieldLabel>
                  <Input
                    disabled={!canManage}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    placeholder="Ej. Harina de maca"
                  />
                  <FieldError>{errors.name}</FieldError>
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field data-invalid={Boolean(errors.base_unit_id)}>
                    <FieldLabel>Se vende por</FieldLabel>
                    <SimpleSelect
                      disabled={!canManage}
                      value={unitId}
                      onChange={setUnitId}
                      invalid={Boolean(errors.base_unit_id)}
                      options={units.map((unit) => ({
                        value: String(unit.id),
                        label: unit.code === "kg" ? "Kilogramo (peso)" : "Unidad",
                      }))}
                    />
                    <FieldError>{errors.base_unit_id}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(errors.sku)}>
                    <FieldLabel>SKU</FieldLabel>
                    <Input
                      disabled={!canManage}
                      value={sku}
                      onChange={(event) => setSku(event.target.value)}
                      placeholder={slug(name) || "Automático"}
                      aria-invalid={Boolean(errors.sku)}
                    />
                    <FieldError>{errors.sku}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(errors.barcode)}>
                    <FieldLabel>Código de barras</FieldLabel>
                    <Input
                      disabled={!canManage}
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                      aria-invalid={Boolean(errors.barcode)}
                    />
                    <FieldError>{errors.barcode}</FieldError>
                  </Field>
                </div>
                {selectedUnit?.code === "kg" ? (
                  <FieldDescription>
                    Se vende por peso: el cajero puede escribir gramos o kilos y el stock se lleva en kg.
                  </FieldDescription>
                ) : null}

                <Field>
                  <FieldLabel>Descripción</FieldLabel>
                  <Textarea
                    disabled={!canManage}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <SwitchField
                    label="Producto activo"
                    description="Los inactivos no se pueden vender ni comprar."
                    checked={isActive}
                    disabled={!canManage}
                    onCheckedChange={setIsActive}
                  />
                  <SwitchField
                    label="Visible en POS"
                    description="Aparece en el catálogo de la caja."
                    checked={posVisible}
                    disabled={!canManage}
                    onCheckedChange={setPosVisible}
                  />
                </div>
              </div>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {canManage ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button disabled={saving} type="submit">
                    {saving ? "Guardando…" : template ? "Guardar cambios" : "Crear producto"}
                  </Button>
                  {saved ? <span className="text-sm text-muted-foreground">Guardado.</span> : null}
                </div>
                {template ? (
                  <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                    <Trash2Icon /> Eliminar producto
                  </Button>
                ) : null}
              </div>
            ) : null}
          </FieldGroup>
        </form>

        {template ? (
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title="¿Eliminar este producto?"
            description="Solo se puede eliminar si nunca se usó en compras, ventas, traslados ni kardex. Si ya tiene movimientos, desactívalo."
            onConfirm={async () => {
              await api.delete(`/product-templates/${template.id}`)
              router.visit("/catalog/products")
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
