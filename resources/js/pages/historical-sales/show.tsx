import { Head, Link, router } from "@inertiajs/react"
import { AlertTriangleIcon, ArrowLeftIcon, CheckCircle2Icon, DownloadIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AppLayout } from "@/layouts/app-layout"

type ProposedItem = {
  product_id: number
  product_name: string
  quantity: string
  unit_code: string
  unit_price: string
  line_total: string
}

type ImportRow = {
  id: number
  row_number: number
  transaction_type: string | null
  origin: string | null
  destination: string | null
  message: string | null
  sold_at: string | null
  expected_total: string | null
  status: string
  proposed_items: ProposedItem[]
  error_message: string | null
  sale_id: number | null
  document_number: string | null
}

type ImportDetail = {
  id: number
  original_filename: string
  status: string
  warehouse: string
  store: string | null
  series_code: string
  document_type: "receipt"
  series_purpose: string
  series_assigned_to_pos: boolean
  current_number: number
  next_number: number
  total_rows: number
  ready_rows: number
  imported_rows: number
  failed_rows: number
  expected_total: string
  imported_total: string
  rows: ImportRow[]
}

export default function HistoricalSaleImportShow({ import: batch }: { import: ImportDetail }) {
  const [confirming, setConfirming] = useState(false)
  const canConfirm = batch.ready_rows > 0
  const lastProvisionalNumber = batch.next_number + Math.max(batch.ready_rows - 1, 0)

  function confirmImport() {
    if (!window.confirm(`Se crearán ${batch.ready_rows} ventas, pagos Yape y boletas nuevas. La serie ${batch.series_code} avanzará hasta ${String(lastProvisionalNumber).padStart(8, "0")}. ¿Continuar?`)) return
    setConfirming(true)
    router.post(`/historical-sales/${batch.id}/confirm`, {}, { onFinish: () => setConfirming(false) })
  }

  return (
    <AppLayout title={`Importación #${batch.id}`}>
      <Head title={`Importación histórica #${batch.id}`} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{batch.store} · {batch.warehouse}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Vista previa Yape #{batch.id}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {batch.original_filename} · Boletas nuevas · Serie {batch.series_code}
            </p>
          </div>
          <div className="flex gap-2">
            <Button nativeButton={false} variant="outline" render={<Link href="/historical-sales" />}><ArrowLeftIcon /> Volver</Button>
            <Button nativeButton={false} variant="outline" render={<a href={`/historical-sales/${batch.id}/file`} />}><DownloadIcon /> Excel original</Button>
            <Button onClick={confirmImport} disabled={!canConfirm || confirming}>
              {confirming ? <LoaderCircleIcon className="animate-spin" /> : <CheckCircle2Icon />}
              Confirmar {batch.ready_rows} ventas
            </Button>
          </div>
        </div>

        {batch.series_purpose === "operational" || batch.series_assigned_to_pos ? (
          <Alert>
            <AlertTriangleIcon />
            <AlertTitle>Confirmar avanzará una serie operativa</AlertTitle>
            <AlertDescription>
              Las {batch.ready_rows} ventas listas usarán {batch.series_code}-{String(batch.next_number).padStart(8, "0")} a {batch.series_code}-{String(lastProvisionalNumber).padStart(8, "0")}. La vista previa todavía no consume esos números.
            </AlertDescription>
          </Alert>
        ) : null}

        {batch.document_type === "receipt" ? (
          <Alert>
            <AlertTriangleIcon />
            <AlertTitle>Estas ventas se registrarán como boletas</AlertTitle>
            <AlertDescription>
              Quedarán emitidas con su serie y correlativo real. Este proceso no realizará el envío automático a SUNAT.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Operaciones TE PAGÓ", batch.total_rows],
            ["Listas", batch.ready_rows],
            ["Importadas", batch.imported_rows],
            ["Total esperado", `S/ ${batch.expected_total}`],
          ].map(([label, value]) => (
            <Card key={label}><CardHeader className="pb-1"><CardDescription>{label}</CardDescription><CardTitle>{value}</CardTitle></CardHeader></Card>
          ))}
        </div>

        {batch.failed_rows > 0 ? (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Hay {batch.failed_rows} filas con observaciones</AlertTitle>
            <AlertDescription>Puedes regenerar las filas que tengan fecha e importe válidos antes de confirmar nuevamente.</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Detalle de ventas</CardTitle>
            <CardDescription>Los correlativos mostrados son provisionales hasta confirmar cada venta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Fila</TableHead><TableHead>Fecha</TableHead><TableHead>Pago Yape</TableHead><TableHead>Documento</TableHead><TableHead>Productos propuestos</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {batch.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.row_number}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.sold_at ? new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.sold_at)) : "—"}
                    </TableCell>
                    <TableCell className="min-w-48">
                      <p className="font-medium">{row.origin ?? "Origen no indicado"}</p>
                      <p className="text-xs text-muted-foreground">Destino: {row.destination ?? "—"}</p>
                      {row.message ? <p className="mt-1 max-w-64 text-xs text-muted-foreground">{row.message}</p> : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.document_number ?? "—"}</TableCell>
                    <TableCell className="min-w-80">
                      {row.proposed_items.length > 0 ? (
                        <div className="space-y-1">
                          {row.proposed_items.map((item) => (
                            <p key={item.product_id} className="text-sm">
                              <span className="font-medium">{item.product_name}</span>{" "}
                              <span className="text-muted-foreground">{Number(item.quantity).toLocaleString("es-PE", { maximumFractionDigits: 6 })} {item.unit_code} × S/ {item.unit_price} = S/ {item.line_total}</span>
                            </p>
                          ))}
                        </div>
                      ) : <span className="text-sm text-destructive">{row.error_message}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{row.expected_total ? `S/ ${row.expected_total}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "imported" ? "default" : row.status === "ready" ? "secondary" : "destructive"}>
                        {row.status === "ready" ? "Lista" : row.status === "imported" ? "Importada" : row.status === "invalid" ? "Observada" : "Falló"}
                      </Badge>
                      {row.error_message && row.proposed_items.length > 0 ? <p className="mt-1 max-w-56 text-xs text-destructive">{row.error_message}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status !== "imported" && row.expected_total && Number(row.expected_total) < 700 ? (
                        <Button size="sm" variant="ghost" onClick={() => router.post(`/historical-sales/${batch.id}/rows/${row.id}/regenerate`)}>
                          <RefreshCwIcon /> Regenerar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
