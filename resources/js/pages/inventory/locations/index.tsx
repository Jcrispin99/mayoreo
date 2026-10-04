import { Head } from "@inertiajs/react"
import { PencilIcon, PlusIcon, StoreIcon, Trash2Icon, WarehouseIcon } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { ConfirmDialog } from "@/components/catalog/confirm-dialog"
import { PageHeading } from "@/components/catalog/page-heading"
import { SimpleSelect } from "@/components/catalog/simple-select"
import { SwitchField } from "@/components/catalog/switch-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { useCan } from "@/hooks/use-can"
import { AppLayout } from "@/layouts/app-layout"
import { ApiError, api, errorMessage } from "@/lib/api"
import type { Store, Warehouse, WarehouseType } from "@/types/catalog"

const WAREHOUSE_TYPES: Record<WarehouseType, string> = {
  main: "Almacén central",
  retail: "Almacén de tienda",
  pos: "Almacén de caja",
}

type StoreEditor = { store: Store | null } | null
type WarehouseEditor = { store: Store; warehouse: Warehouse | null } | null
type PendingDelete = { kind: "store"; store: Store } | { kind: "warehouse"; warehouse: Warehouse } | null

function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages[0]]))
}

export default function LocationsIndex() {
  const can = useCan()
  const canManageStores = can("stores.manage")
  const canManageWarehouses = can("warehouses.manage")
  const [storeEditor, setStoreEditor] = useState<StoreEditor>(null)
  const [warehouseEditor, setWarehouseEditor] = useState<WarehouseEditor>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)

  const { data: stores, loading, error, reload } = useApi(() => api.get<Store[]>("/stores"), [], "No se pudieron cargar las tiendas.")

  return (
    <AppLayout title="Tiendas y almacenes">
      <Head title="Tiendas y almacenes" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeading
          eyebrow="Inventario"
          title="Tiendas y almacenes"
          description="Cada tienda tiene al menos un almacén; el predeterminado es el que usan sus cajas y compras por defecto."
          actions={
            canManageStores ? (
              <Button onClick={() => setStoreEditor({ store: null })}>
                <PlusIcon /> Nueva tienda
              </Button>
            ) : null
          }
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !stores ? (
          <Skeleton className="h-64 w-full" />
        ) : (stores ?? []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <StoreIcon className="size-10 text-muted-foreground" />
              <p className="font-medium">Todavía no hay tiendas</p>
            </CardContent>
          </Card>
        ) : (
          (stores ?? []).map((store) => (
            <Card key={store.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <StoreIcon className="size-4 text-muted-foreground" />
                      {store.name}
                      <span className="font-mono text-xs font-normal text-muted-foreground">{store.code}</span>
                      {!store.is_active ? <Badge variant="outline">Inactiva</Badge> : null}
                    </CardTitle>
                    <CardDescription>
                      {[store.address, store.phone].filter(Boolean).join(" · ") || "Sin dirección ni teléfono"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManageWarehouses ? (
                      <Button size="sm" variant="outline" onClick={() => setWarehouseEditor({ store, warehouse: null })}>
                        <PlusIcon /> Almacén
                      </Button>
                    ) : null}
                    {canManageStores ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setStoreEditor({ store })}>
                          <PencilIcon /> Editar
                        </Button>
                        <Button aria-label="Eliminar tienda" size="icon-sm" variant="ghost" onClick={() => setPendingDelete({ kind: "store", store })}>
                          <Trash2Icon />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      {canManageWarehouses ? <TableHead className="w-24" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {store.warehouses.map((warehouse) => (
                      <TableRow key={warehouse.id}>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            <WarehouseIcon className="size-4 text-muted-foreground" />
                            {warehouse.name}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{warehouse.code}</TableCell>
                        <TableCell>{WAREHOUSE_TYPES[warehouse.type] ?? warehouse.type}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {warehouse.is_default ? <Badge>Predeterminado</Badge> : null}
                            <Badge variant={warehouse.is_active ? "secondary" : "outline"}>{warehouse.is_active ? "Activo" : "Inactivo"}</Badge>
                          </div>
                        </TableCell>
                        {canManageWarehouses ? (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button aria-label="Editar almacén" size="icon-sm" variant="ghost" onClick={() => setWarehouseEditor({ store, warehouse })}>
                                <PencilIcon />
                              </Button>
                              {!warehouse.is_default ? (
                                <Button aria-label="Eliminar almacén" size="icon-sm" variant="ghost" onClick={() => setPendingDelete({ kind: "warehouse", warehouse })}>
                                  <Trash2Icon />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}

        <p className="text-xs text-muted-foreground">
          Los datos SUNAT del establecimiento se configuran en Configuración SUNAT y la ubicación de asistencia en QR de asistencia.
        </p>
      </div>

      <StoreDialog editor={storeEditor} onClose={() => setStoreEditor(null)} onSaved={reload} />
      <WarehouseDialog editor={warehouseEditor} onClose={() => setWarehouseEditor(null)} onSaved={reload} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={pendingDelete?.kind === "store" ? "¿Eliminar esta tienda?" : "¿Eliminar este almacén?"}
        description={
          pendingDelete?.kind === "store"
            ? "Solo se puede eliminar si sus almacenes nunca tuvieron stock, ventas, compras ni traslados, y no tiene personal asignado. Si no, desactívala."
            : "Solo se puede eliminar si nunca tuvo stock, ventas, compras ni traslados. Si no, desactívalo."
        }
        onConfirm={async () => {
          if (pendingDelete?.kind === "store") await api.delete(`/stores/${pendingDelete.store.id}`)
          if (pendingDelete?.kind === "warehouse") await api.delete(`/warehouses/${pendingDelete.warehouse.id}`)
          await reload()
        }}
      />
    </AppLayout>
  )
}

function StoreDialog({ editor, onClose, onSaved }: { editor: StoreEditor; onClose: () => void; onSaved: () => Promise<void> }) {
  const store = editor?.store ?? null
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!editor) return
    setCode(store?.code ?? "")
    setName(store?.name ?? "")
    setAddress(store?.address ?? "")
    setPhone(store?.phone ?? "")
    setIsActive(store?.is_active ?? true)
    setError("")
    setErrors({})
  }, [editor, store])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!code.trim() || !name.trim()) {
      setErrors({ code: code.trim() ? "" : "Ingresa un código.", name: name.trim() ? "" : "Ingresa un nombre." })
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        is_active: isActive,
      }
      if (store) await api.put(`/stores/${store.id}`, payload)
      else await api.post("/stores", payload)
      await onSaved()
      onClose()
    } catch (requestError) {
      setErrors(fieldErrors(requestError))
      setError(errorMessage(requestError, "No se pudo guardar la tienda."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{store ? "Editar tienda" : "Nueva tienda"}</DialogTitle>
          <DialogDescription>
            {store ? store.name : "Se crea junto con su almacén principal."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <Field data-invalid={Boolean(errors.code)}>
                <FieldLabel>Código</FieldLabel>
                <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="LIM-01" aria-invalid={Boolean(errors.code)} />
                <FieldError>{errors.code}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel>Nombre</FieldLabel>
                <Input value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} />
                <FieldError>{errors.name}</FieldError>
              </Field>
            </div>
            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel>Dirección</FieldLabel>
              <Input value={address} onChange={(event) => setAddress(event.target.value)} />
              <FieldError>{errors.address}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel>Teléfono</FieldLabel>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
              <FieldError>{errors.phone}</FieldError>
            </Field>
            <SwitchField label="Tienda activa" checked={isActive} onCheckedChange={setIsActive} />
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
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

function WarehouseDialog({ editor, onClose, onSaved }: { editor: WarehouseEditor; onClose: () => void; onSaved: () => Promise<void> }) {
  const warehouse = editor?.warehouse ?? null
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<WarehouseType>("retail")
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!editor) return
    setCode(warehouse?.code ?? "")
    setName(warehouse?.name ?? "")
    setType(warehouse?.type ?? "retail")
    setIsActive(warehouse?.is_active ?? true)
    setIsDefault(warehouse?.is_default ?? false)
    setError("")
    setErrors({})
  }, [editor, warehouse])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    if (!code.trim() || !name.trim()) {
      setErrors({ code: code.trim() ? "" : "Ingresa un código.", name: name.trim() ? "" : "Ingresa un nombre." })
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        type,
        is_active: isDefault ? true : isActive,
        is_default: isDefault,
      }
      if (warehouse) await api.put(`/warehouses/${warehouse.id}`, payload)
      else await api.post("/warehouses", { ...payload, store_id: editor.store.id })
      await onSaved()
      onClose()
    } catch (requestError) {
      setErrors(fieldErrors(requestError))
      setError(errorMessage(requestError, "No se pudo guardar el almacén."))
    } finally {
      setSaving(false)
    }
  }

  const lockedDefault = warehouse?.is_default ?? false

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{warehouse ? "Editar almacén" : "Nuevo almacén"}</DialogTitle>
          <DialogDescription>{editor?.store.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <div className="grid grid-cols-[140px_1fr] gap-4">
              <Field data-invalid={Boolean(errors.code)}>
                <FieldLabel>Código</FieldLabel>
                <Input value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={Boolean(errors.code)} />
                <FieldError>{errors.code}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel>Nombre</FieldLabel>
                <Input value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} />
                <FieldError>{errors.name}</FieldError>
              </Field>
            </div>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <SimpleSelect
                value={type}
                onChange={(value) => setType(value as WarehouseType)}
                options={Object.entries(WAREHOUSE_TYPES).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <SwitchField
              label="Almacén predeterminado"
              description="El que usa la tienda por defecto. Solo puede haber uno por tienda."
              checked={isDefault}
              disabled={lockedDefault}
              onCheckedChange={setIsDefault}
            />
            <SwitchField label="Almacén activo" checked={isDefault || isActive} disabled={isDefault} onCheckedChange={setIsActive} />
            {lockedDefault ? (
              <FieldDescription>Para cambiar el predeterminado, marca otro almacén de esta tienda como predeterminado.</FieldDescription>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
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
