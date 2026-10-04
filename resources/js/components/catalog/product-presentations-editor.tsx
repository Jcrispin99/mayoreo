import { CheckCircle2Icon, Layers3Icon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError, api, errorMessage } from "@/lib/api"
import { formatDecimal, formatMoney, slug } from "@/lib/catalog-format"
import { templateFlags, variantPayload, type AttributePayload, type VariantPayload } from "@/lib/product-template-payload"
import { cn } from "@/lib/utils"
import type { AttributeSelection, ProductTemplate, Unit, Variant } from "@/types/catalog"

/*
 * Misma lógica que la pantalla "Atributos" de la app móvil: cada combinación
 * de valores es una presentación; la principal (granel en kg o unidad suelta)
 * se conserva aparte y no lleva atributos.
 */

type ValueRow = { key: string; value: string; factor: string; price: string }
type AttributeRow = {
  key: string
  name: string
  values: ValueRow[]
  pending: string
  pendingFactor: string
  pendingPrice: string
}
type Draft = VariantPayload & { signature: string; isNew: boolean }
type Override = { sku?: string; barcode?: string }

let keySequence = 0
function draftKey() {
  keySequence += 1
  return `draft-${keySequence}`
}

function blankAttribute(name = ""): AttributeRow {
  return {
    key: draftKey(),
    name,
    values: [],
    pending: "",
    pendingFactor: "",
    pendingPrice: "",
  }
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("es")
}

function selectionSignature(selections: AttributeSelection[]) {
  return [...selections]
    .sort((first, second) => normalized(first.attribute).localeCompare(normalized(second.attribute)))
    .map((selection) => `${normalized(selection.attribute)}:${normalized(selection.value)}`)
    .join("|")
}

function cartesianProduct(attributes: AttributeRow[]): AttributeSelection[][] {
  return attributes.reduce<AttributeSelection[][]>(
    (combinations, attribute) => combinations.flatMap((combination) =>
      attribute.values.map((value) => [...combination, { attribute: attribute.name.trim(), value: value.value }]),
    ),
    [[]],
  )
}

const WEIGHT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr)\s*$/i
const COUNT_PATTERNS = [
  /(?:^|\s)x\s*(\d+(?:[.,]\d+)?)\s*$/i,
  /(\d+(?:[.,]\d+)?)\s*(?:un|und|unidad|unidades)\s*$/i,
]

/** Sugiere la equivalencia desde valores como "500 g" o "Caja x12". */
function suggestedFactor(value: string, principalUnit: Unit | undefined) {
  if (principalUnit?.code === "kg") {
    const match = value.trim().match(WEIGHT_PATTERN)
    if (!match) return ""
    const amount = Number(match[1].replace(",", "."))
    return String(match[2].toLowerCase() === "kg" ? amount : amount / 1000)
  }

  if (principalUnit?.type === "count") {
    for (const pattern of COUNT_PATTERNS) {
      const match = value.trim().match(pattern)
      if (match) return String(Number(match[1].replace(",", ".")))
    }
  }

  return ""
}

function findValue(attributes: AttributeRow[], selection: AttributeSelection) {
  const attribute = attributes.find((item) => normalized(item.name) === normalized(selection.attribute))
  return attribute?.values.find((item) => normalized(item.value) === normalized(selection.value))
}

function contentFromSelections(selections: AttributeSelection[], attributes: AttributeRow[], principalUnit: Unit | undefined, kgUnit: Unit | undefined) {
  if (principalUnit) {
    for (const selection of selections) {
      const value = findValue(attributes, selection)
      if (value && value.factor.trim() && Number(value.factor) > 0) {
        return { content_quantity: value.factor.trim(), content_unit_id: principalUnit.id }
      }
    }
  }

  for (const selection of selections) {
    const match = selection.value.trim().match(WEIGHT_PATTERN)
    if (!match || !kgUnit) continue
    const amount = Number(match[1].replace(",", "."))
    if (Number.isFinite(amount)) {
      return { content_quantity: String(match[2].toLowerCase() === "kg" ? amount : amount / 1000), content_unit_id: kgUnit.id }
    }
  }

  return { content_quantity: null, content_unit_id: null }
}

function priceForSelections(selections: AttributeSelection[], attributes: AttributeRow[]) {
  let configured = false
  let total = 0
  selections.forEach((selection) => {
    const value = findValue(attributes, selection)
    if (!value || !value.price.trim()) return
    const parsed = Number(value.price.replace(",", "."))
    if (!Number.isFinite(parsed)) return
    configured = true
    total += parsed
  })
  return configured && total > 0 ? total : null
}

function rowsFromTemplate(template: ProductTemplate): AttributeRow[] {
  return template.attributes.map((attribute) => ({
    key: `attribute-${attribute.id}`,
    name: attribute.name,
    pending: "",
    pendingFactor: "",
    pendingPrice: "",
    values: attribute.values.map((value) => ({
      key: `value-${value.id}`,
      value: value.value,
      factor: formatDecimal(value.factor, 4),
      price: Number(value.price) > 0 ? formatDecimal(value.price, 4) : "",
    })),
  }))
}

function initialRows(template: ProductTemplate, canManage: boolean) {
  const rows = rowsFromTemplate(template)
  return rows.length > 0 || !canManage ? rows : [blankAttribute()]
}

function buildDrafts(
  template: ProductTemplate,
  attributes: AttributeRow[],
  units: Unit[],
  overrides: Record<string, Override>,
): Draft[] {
  const countUnit = units.find((unit) => unit.type === "count") ?? units[0]
  const kgUnit = units.find((unit) => unit.code === "kg")
  const principal = template.variants.find((variant) => variant.is_principal) ?? template.variants[0]
  const principalUnit = units.find((unit) => unit.id === principal?.base_unit_id)

  const withOverride = (draft: Draft): Draft => {
    const override = overrides[draft.signature]
    return {
      ...draft,
      sku: override?.sku ?? draft.sku,
      barcode: override?.barcode !== undefined ? override.barcode || null : draft.barcode,
    }
  }

  const drafts: Draft[] = []
  if (principal) {
    drafts.push(withOverride({
      ...variantPayload(principal),
      variant_name: principal.sale_mode === "measured" ? "Kilogramos" : principal.variant_name,
      attribute_values: [],
      is_active: true,
      is_principal: true,
      signature: "principal",
      isNew: false,
    }))
  }

  if (attributes.length === 0) return drafts

  const existing = new Map<string, Variant>()
  template.variants
    .filter((variant) => !variant.is_principal && variant.attribute_values.length > 0)
    .forEach((variant) => existing.set(selectionSignature(variant.attribute_values), variant))

  cartesianProduct(attributes).forEach((selections) => {
    const signature = selectionSignature(selections)
    const match = existing.get(signature)
    const content = contentFromSelections(selections, attributes, principalUnit, kgUnit)
    const values = selections.map((selection) => selection.value)
    const basePrice = priceForSelections(selections, attributes)

    const draft: Draft = match
      ? {
          ...variantPayload(match),
          variant_name: values.join(" / "),
          attribute_values: selections,
          content_quantity: content.content_quantity ?? match.content_quantity,
          content_unit_id: content.content_unit_id ?? match.content_unit_id,
          is_active: true,
          is_principal: false,
          signature,
          isNew: false,
        }
      : {
          variant_name: values.join(" / "),
          sku: slug([template.name || "PRODUCTO", ...values].join("-")),
          barcode: null,
          base_unit_id: countUnit?.id ?? null,
          sale_mode: "unit",
          ...content,
          is_active: true,
          is_favorite: false,
          is_principal: false,
          attribute_values: selections,
          signature,
          isNew: true,
        }

    drafts.push(withOverride(basePrice === null ? draft : { ...draft, base_price: basePrice }))
  })

  return drafts
}

type ProductPresentationsEditorProps = {
  template: ProductTemplate
  units: Unit[]
  canManage: boolean
  onSaved: (template: ProductTemplate) => void
}

export function ProductPresentationsEditor({ template, units, canManage, onSaved }: ProductPresentationsEditorProps) {
  const [attributes, setAttributes] = useState<AttributeRow[]>(() => initialRows(template, canManage))
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAttributes(initialRows(template, canManage))
    setOverrides({})
    setRowErrors({})
  }, [template, canManage])

  const principal = template.variants.find((variant) => variant.is_principal) ?? template.variants[0]
  const principalUnit = units.find((unit) => unit.id === principal?.base_unit_id)
  const byWeight = principalUnit?.code === "kg"
  const contentUnitLabel = byWeight ? "kg" : "un."

  const configuredAttributes = useMemo(
    () => attributes.filter((attribute) => attribute.name.trim() || attribute.values.length > 0),
    [attributes],
  )
  const drafts = useMemo(
    () => buildDrafts(template, configuredAttributes, units, overrides),
    [template, configuredAttributes, units, overrides],
  )
  const keptIds = new Set(drafts.map((draft) => draft.id).filter(Boolean))
  const removed = template.variants.filter((variant) => variant.is_active && !keptIds.has(variant.id))

  function updateAttribute(key: string, changes: Partial<AttributeRow>) {
    setAttributes((current) => current.map((attribute) => (attribute.key === key ? { ...attribute, ...changes } : attribute)))
    setSaved(false)
  }

  function addAttribute(name = "") {
    setAttributes((current) => [...current, blankAttribute(name)])
    setSaved(false)
  }

  function updatePendingValue(key: string, value: string) {
    setAttributes((current) => current.map((attribute) => {
      if (attribute.key !== key) return attribute

      const previousSuggestion = suggestedFactor(attribute.pending, principalUnit)
      const nextSuggestion = suggestedFactor(value, principalUnit)
      const factorWasAutomatic = attribute.pendingFactor === "" || attribute.pendingFactor === previousSuggestion

      return {
        ...attribute,
        pending: value,
        pendingFactor: factorWasAutomatic ? nextSuggestion : attribute.pendingFactor,
      }
    }))
    setSaved(false)
  }

  function addValue(key: string) {
    setAttributes((current) => current.map((attribute) => {
      if (attribute.key !== key) return attribute
      const value = attribute.pending.trim()
      if (!value || attribute.values.some((item) => normalized(item.value) === normalized(value))) {
        return attribute
      }
      return {
        ...attribute,
        pending: "",
        pendingFactor: "",
        pendingPrice: "",
        values: [...attribute.values, {
          key: draftKey(),
          value,
          factor: attribute.pendingFactor.trim() || suggestedFactor(value, principalUnit),
          price: attribute.pendingPrice.trim(),
        }],
      }
    }))
    setSaved(false)
  }

  function updateValue(attributeKey: string, valueKey: string, changes: Partial<Pick<ValueRow, "factor" | "price">>) {
    setAttributes((current) => current.map((attribute) => (
      attribute.key === attributeKey
        ? { ...attribute, values: attribute.values.map((value) => (value.key === valueKey ? { ...value, ...changes } : value)) }
        : attribute
    )))
    setSaved(false)
  }

  function removeValue(attributeKey: string, valueKey: string) {
    setAttributes((current) => current.map((attribute) => (
      attribute.key === attributeKey ? { ...attribute, values: attribute.values.filter((value) => value.key !== valueKey) } : attribute
    )))
    setSaved(false)
  }

  function override(signature: string, changes: Override) {
    setOverrides((current) => ({ ...current, [signature]: { ...current[signature], ...changes } }))
    setSaved(false)
  }

  async function save() {
    if (configuredAttributes.some((attribute) => !attribute.name.trim() || attribute.values.length === 0)) {
      setError("Cada atributo necesita un nombre y al menos un valor.")
      return
    }
    if (new Set(configuredAttributes.map((attribute) => normalized(attribute.name))).size !== configuredAttributes.length) {
      setError("No repitas el mismo atributo.")
      return
    }
    const values = configuredAttributes.flatMap((attribute) => attribute.values)
    if (values.some((value) => value.price.trim() !== "" && !(Number(value.price.replace(",", ".")) >= 0))) {
      setError("Los precios deben ser números iguales o mayores que cero.")
      return
    }
    if (values.some((value) => value.factor.trim() !== "" && !(Number(value.factor.replace(",", ".")) > 0))) {
      setError("El contenido debe ser un número mayor que cero.")
      return
    }
    if (drafts.some((draft) => !draft.sku.trim())) {
      setError("Todas las variantes necesitan un SKU.")
      return
    }

    setSaving(true)
    setError("")
    setRowErrors({})
    try {
      const attributePayload: AttributePayload[] = configuredAttributes.map((attribute) => ({
        name: attribute.name.trim(),
        values: attribute.values.map((value) => value.value),
        value_prices: Object.fromEntries(attribute.values.map((value) => [value.value, value.price.trim().replace(",", ".") || 0])),
        value_factors: Object.fromEntries(attribute.values.map((value) => [value.value, value.factor.trim().replace(",", ".") || null])),
      }))
      const result = await api.put<ProductTemplate>(`/product-templates/${template.id}`, {
        ...templateFlags(template),
        attributes: attributePayload,
        variants: drafts.map(({ signature: _signature, isNew: _isNew, ...draft }) => ({ ...draft, sku: draft.sku.trim() })),
      })
      onSaved(result)
      setSaved(true)
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        const mapped: Record<number, string> = {}
        Object.entries(requestError.errors).forEach(([key, messages]) => {
          const match = key.match(/^variants\.(\d+)\./)
          if (match) mapped[Number(match[1])] = messages[0]
        })
        setRowErrors(mapped)
      }
      setError(errorMessage(requestError, "No se pudieron guardar las variantes."))
    } finally {
      setSaving(false)
    }
  }

  const combinationCount = configuredAttributes.length === 0
    ? 0
    : configuredAttributes.reduce((total, attribute) => total * attribute.values.length, 1)

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/8 via-card to-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Layers3Icon className="size-4" /> Configuración de variantes
            </div>
            <h2 className="text-xl font-semibold tracking-tight">¿Cómo se ofrece este producto?</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Crea opciones como peso, tamaño, color o presentación. La web combinará sus valores y te mostrará
              exactamente las variantes que se guardarán.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg border bg-background/80 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Variantes adicionales</p>
              <p className="text-2xl font-semibold tabular-nums">{Math.max(drafts.length - 1, 0)}</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SparklesIcon className="size-4" />
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["1", "Define una opción", "Ej. Peso o Tamaño"],
            ["2", "Agrega sus valores", "Ej. 500 g y 1 kg"],
            ["3", "Revisa y guarda", "SKU y código de barras"],
          ].map(([step, title, description]) => (
            <div key={step} className="flex items-center gap-3 rounded-lg bg-background/70 px-3 py-2.5 ring-1 ring-foreground/8">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {step}
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>1. Opciones y valores</CardTitle>
          <CardDescription>
            {byWeight
              ? "La venta libre en kilogramos se conserva como variante principal. Para paquetes, indica cuánto contiene cada valor; por ejemplo, 500 g equivale a 0.5 kg."
              : "Indica cuántas unidades contiene cada empaque. Por ejemplo, Caja x12 equivale a 12 unidades y descuenta 12 del stock principal."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {attributes.map((attribute, attributeIndex) => (
            <div key={attribute.key} className="overflow-hidden rounded-xl border">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/35 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold ring-1 ring-foreground/10">
                  {attributeIndex + 1}
                </span>
                <Input
                  className="min-w-52 max-w-xs flex-1 bg-background font-medium"
                  disabled={!canManage}
                  placeholder="Nombre de la opción (ej. Peso)"
                  value={attribute.name}
                  onChange={(event) => updateAttribute(attribute.key, { name: event.target.value })}
                />
                {canManage ? (
                  <Button
                    className="ml-auto"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAttributes((current) => current.filter((item) => item.key !== attribute.key))
                      setSaved(false)
                    }}
                  >
                    <Trash2Icon /> Quitar opción
                  </Button>
                ) : null}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor de la opción</TableHead>
                    <TableHead className="w-40">Equivale a ({contentUnitLabel})</TableHead>
                    <TableHead className="w-40">Precio base (S/)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attribute.values.map((value) => (
                    <TableRow key={value.key}>
                      <TableCell className="font-medium">{value.value}</TableCell>
                      <TableCell>
                        <Input
                          disabled={!canManage}
                          inputMode="decimal"
                          placeholder="1"
                          value={value.factor}
                          onChange={(event) => updateValue(attribute.key, value.key, { factor: event.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={!canManage}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={value.price}
                          onChange={(event) => updateValue(attribute.key, value.key, { price: event.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <Button aria-label={`Quitar ${value.value}`} size="icon-sm" variant="ghost" onClick={() => removeValue(attribute.key, value.key)}>
                            <XIcon />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {canManage ? (
                    <TableRow className="bg-primary/[0.025] hover:bg-primary/[0.04]">
                      <TableCell className="p-0">
                        <Input
                          aria-label="Nuevo valor de la opción"
                          className="h-11 min-w-56 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-inset"
                          placeholder={attribute.values.length === 0 ? (byWeight ? "Ej. 500 g" : "Ej. Caja x12") : "Nuevo valor"}
                          value={attribute.pending}
                          onChange={(event) => updatePendingValue(attribute.key, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              addValue(attribute.key)
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-0">
                        <Input
                          aria-label={`Equivalencia en ${contentUnitLabel}`}
                          className="h-11 min-w-36 rounded-none border-0 bg-transparent px-3 text-right shadow-none focus-visible:ring-inset"
                          inputMode="decimal"
                          placeholder="1"
                          value={attribute.pendingFactor}
                          onChange={(event) => updateAttribute(attribute.key, { pendingFactor: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              addValue(attribute.key)
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-0">
                        <Input
                          aria-label="Precio base"
                          className="h-11 min-w-36 rounded-none border-0 bg-transparent px-3 text-right shadow-none focus-visible:ring-inset"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={attribute.pendingPrice}
                          onChange={(event) => updateAttribute(attribute.key, { pendingPrice: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              addValue(attribute.key)
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1">
                        <Button
                          aria-label="Agregar fila"
                          disabled={!attribute.pending.trim()}
                          size="icon-sm"
                          title="Agregar fila"
                          variant="ghost"
                          onClick={() => addValue(attribute.key)}
                        >
                          <PlusIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              {canManage ? (
                <p className="border-t bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                  Completa la fila y presiona Enter o el botón +. Siempre quedará una fila vacía lista para el siguiente valor.
                </p>
              ) : null}
            </div>
          ))}

          {canManage ? (
            <Button
              className="self-start"
              variant="outline"
              onClick={() => addAttribute()}
            >
              <PlusIcon /> {attributes.length === 0 ? "Agregar opción" : "Agregar otra opción"}
            </Button>
          ) : null}
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            La equivalencia es opcional: si la dejas vacía, esa variante tendrá stock propio. El precio base de cada valor
            se suma cuando hay varias opciones. Después puedes crear precios por cantidad desde la pestaña{" "}
            <span className="font-medium text-foreground">Precios</span>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>2. Variantes que se guardarán</CardTitle>
          <CardDescription>
            {configuredAttributes.length === 0
              ? "Solo existe la variante principal. Agrega una opción arriba para crear variantes."
              : `Se generaron ${combinationCount} combinación(es), además de la variante principal. Revisa el SKU y el código de barras.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Código de barras</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Precio base</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((draft, index) => (
                <TableRow key={draft.signature}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">
                        {draft.variant_name || (draft.is_principal ? "Principal" : "Variante")}
                      </span>
                      {draft.is_principal ? <Badge>Principal</Badge> : null}
                      {draft.isNew ? <Badge variant="secondary">Nueva</Badge> : null}
                    </div>
                    {rowErrors[index] ? <p className="mt-1 text-xs text-destructive">{rowErrors[index]}</p> : null}
                  </TableCell>
                  <TableCell>
                    <Input
                      className={cn("min-w-40 font-mono text-xs", rowErrors[index] && "border-destructive")}
                      disabled={!canManage}
                      value={draft.sku}
                      onChange={(event) => override(draft.signature, { sku: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="min-w-36 font-mono text-xs"
                      disabled={!canManage}
                      placeholder="Sin código"
                      value={draft.barcode ?? ""}
                      onChange={(event) => override(draft.signature, { barcode: event.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {draft.is_principal
                      ? "Stock principal"
                      : draft.content_quantity
                        ? `Descuenta ${formatDecimal(draft.content_quantity, 3)} ${contentUnitLabel}`
                        : "Stock propio"}
                  </TableCell>
                  <TableCell className="text-right">
                    {draft.base_price !== undefined ? formatMoney(draft.base_price) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {removed.map((variant) => (
                <TableRow key={`removed-${variant.id}`} className="opacity-60">
                  <TableCell colSpan={5}>
                    <Badge variant="outline">Se desactivará</Badge>{" "}
                    <span className="ml-1 line-through">{variant.variant_name || variant.sku}</span>{" "}
                    <span className="text-xs text-muted-foreground">Su historial no se eliminará.</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button size="lg" disabled={saving} onClick={() => void save()}>
                {saving ? "Guardando…" : "Guardar variantes"}
              </Button>
              {saved ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4" /> Variantes guardadas
                </span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
