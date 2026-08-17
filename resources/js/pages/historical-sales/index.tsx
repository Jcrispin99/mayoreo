import { Head, Link } from "@inertiajs/react"
import { FilePlus2Icon, HistoryIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AppLayout } from "@/layouts/app-layout"

type ImportSummary = {
  id: number
  original_filename: string
  status: string
  warehouse: string
  store: string | null
  series_code: string
  document_type: "receipt"
  total_rows: number
  imported_rows: number
  failed_rows: number
  expected_total: string
  created_at: string | null
}

const statusLabels: Record<string, string> = {
  draft: "Procesando",
  ready: "Lista para confirmar",
  invalid: "Sin filas válidas",
  partial: "Importación parcial",
  completed: "Completada",
}

export default function HistoricalSalesIndex({ imports }: { imports: ImportSummary[] }) {
  return (
    <AppLayout title="Boletas desde Yape">
      <Head title="Boletas desde Yape" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Importaciones Yape</p>
            <h1 className="text-2xl font-semibold tracking-tight">Boletas desde Yape</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea ventas, pagos Yape y boletas nuevas desde las operaciones TE PAGÓ del Excel.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/historical-sales/create" />}>
            <FilePlus2Icon /> Nueva importación
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lotes recientes</CardTitle>
            <CardDescription>Se muestran las últimas 50 cargas realizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {imports.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <HistoryIcon className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Todavía no hay importaciones</p>
                  <p className="text-sm text-muted-foreground">Carga el primer Excel para generar una vista previa.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Serie</TableHead>
                    <TableHead>TE PAGÓ</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="max-w-52 truncate font-medium">{item.original_filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.created_at ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)) : "—"}
                        </p>
                      </TableCell>
                      <TableCell>{item.store} · {item.warehouse}</TableCell>
                      <TableCell>
                        <p>Boleta</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.series_code}</p>
                      </TableCell>
                      <TableCell>{item.imported_rows}/{item.total_rows}</TableCell>
                      <TableCell>S/ {item.expected_total}</TableCell>
                      <TableCell>
                        <Badge variant={item.failed_rows > 0 ? "destructive" : item.status === "completed" ? "default" : "secondary"}>
                          {statusLabels[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/historical-sales/${item.id}`} />}>Ver</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
