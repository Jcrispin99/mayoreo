import { Head, Link, useForm } from "@inertiajs/react"
import { ArrowLeftIcon, DownloadIcon, FileSpreadsheetIcon, LoaderCircleIcon } from "lucide-react"
import type { FormEvent } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppLayout } from "@/layouts/app-layout"

type WarehouseOption = {
  id: number
  name: string
  code: string
  store_name: string | null
  fiscal_issuer_id: number | null
}

type SeriesOption = {
  id: number
  fiscal_issuer_id: number | null
  document_type: "sales_ticket" | "receipt"
  series_code: string
  current_number: number
  next_number: number
  purpose: string
  assigned_to_pos: boolean
}

const documentLabels = {
  sales_ticket: "Nota de venta",
  receipt: "Boleta SUNAT",
}

function formattedNumber(number: number) {
  return String(number).padStart(8, "0")
}

export default function CreateHistoricalSaleImport({ warehouses, series }: { warehouses: WarehouseOption[]; series: SeriesOption[] }) {
  const form = useForm({
    warehouse_id: "",
    document_series_id: "",
    file: null as File | null,
  })
  const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === form.data.warehouse_id)
  const availableSeries = series.filter((item) => item.fiscal_issuer_id === selectedWarehouse?.fiscal_issuer_id)
  const selectedSeries = availableSeries.find((item) => String(item.id) === form.data.document_series_id)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.post("/historical-sales", { forceFormData: true })
  }

  return (
    <AppLayout title="Nueva importación">
      <Head title="Nueva importación histórica" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Ventas históricas</p>
            <h1 className="text-2xl font-semibold tracking-tight">Cargar archivo Excel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Primero se generará una vista previa. Los correlativos todavía no se consumirán.
            </p>
          </div>
          <Button nativeButton={false} variant="outline" render={<Link href="/historical-sales" />}>
            <ArrowLeftIcon /> Volver
          </Button>
        </div>

        <Alert>
          <FileSpreadsheetIcon />
          <AlertTitle>Formato esperado</AlertTitle>
          <AlertDescription>
            La primera hoja debe contener las columnas fecha, hora y total. La hora es opcional si está incluida en fecha.
            <a className="ml-1" href="/historical-sales/template">Descargar plantilla</a>.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Configuración del lote</CardTitle>
            <CardDescription>
              Selecciona una serie real del emisor. Su correlativo solo avanzará cuando confirmes las ventas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit}>
              <FieldGroup>
                <Field data-invalid={Boolean(form.errors.warehouse_id)}>
                  <FieldLabel>Almacén</FieldLabel>
                  <Select
                    value={form.data.warehouse_id}
                    onValueChange={(value) => {
                      form.setData("warehouse_id", value ?? "")
                      form.setData("document_series_id", "")
                    }}
                  >
                    <SelectTrigger className="w-full" aria-invalid={Boolean(form.errors.warehouse_id)}>
                      <SelectValue placeholder="Selecciona una tienda y almacén" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.store_name} · {warehouse.name} ({warehouse.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{form.errors.warehouse_id}</FieldError>
                </Field>

                <Field data-invalid={Boolean(form.errors.document_series_id)}>
                  <FieldLabel>Tipo de documento y serie</FieldLabel>
                  <Select
                    value={form.data.document_series_id}
                    onValueChange={(value) => form.setData("document_series_id", value ?? "")}
                    disabled={!selectedWarehouse || form.processing}
                  >
                    <SelectTrigger className="w-full" aria-invalid={Boolean(form.errors.document_series_id)}>
                      <SelectValue placeholder={selectedWarehouse ? "Selecciona una serie" : "Primero selecciona un almacén"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSeries.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {documentLabels[item.document_type]} · {item.series_code} · siguiente {formattedNumber(item.next_number)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {selectedWarehouse && availableSeries.length === 0
                      ? "Este emisor no tiene series activas de nota de venta o boleta. Configura una antes de importar."
                      : "Se muestran solamente las series activas del emisor asociado al almacén."}
                  </FieldDescription>
                  <FieldError>{form.errors.document_series_id}</FieldError>
                </Field>

                {selectedSeries?.purpose === "operational" || selectedSeries?.assigned_to_pos ? (
                  <Alert>
                    <AlertTitle>Serie operativa</AlertTitle>
                    <AlertDescription>
                      Esta serie también puede ser usada por ventas normales. Al confirmar, su correlativo continuará desde {formattedNumber(selectedSeries.next_number)}.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {selectedSeries?.document_type === "receipt" ? (
                  <Alert variant={selectedWarehouse?.fiscal_issuer_id === null ? "destructive" : "default"}>
                    <AlertTitle>Boletas electrónicas</AlertTitle>
                    <AlertDescription>
                      {selectedWarehouse?.fiscal_issuer_id === null
                        ? "La tienda todavía no tiene un emisor fiscal configurado. La boleta puede registrarse internamente, pero no podrá enviarse a SUNAT hasta completar esa configuración."
                        : "Se crearán como boletas emitidas con esta serie. La importación no las enviará automáticamente a SUNAT."}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Field data-invalid={Boolean(form.errors.file)}>
                  <FieldLabel htmlFor="file">Archivo Excel</FieldLabel>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => form.setData("file", event.target.files?.[0] ?? null)}
                    disabled={form.processing}
                    required
                  />
                  <FieldDescription>Máximo 10 MB y 1000 filas por lote.</FieldDescription>
                  <FieldError>{form.errors.file}</FieldError>
                </Field>

                <Button type="submit" size="lg" disabled={form.processing || warehouses.length === 0 || !selectedSeries}>
                  {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
                  {form.processing ? "Analizando archivo…" : "Cargar y generar vista previa"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
