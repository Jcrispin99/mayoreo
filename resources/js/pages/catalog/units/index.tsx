import { Head } from "@inertiajs/react"
import { LockIcon } from "lucide-react"

import { PageHeading } from "@/components/catalog/page-heading"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { AppLayout } from "@/layouts/app-layout"
import { api } from "@/lib/api"
import type { Unit } from "@/types/catalog"

const USAGE: Record<string, string> = {
  NIU: "Productos que se venden por pieza: botellas, paquetes, sartas, cajas.",
  kg: "Productos a granel que se venden por peso. En caja se puede escribir en gramos o kilos.",
}

export default function UnitsIndex() {
  const { data: units, loading, error } = useApi(() => api.get<Unit[]>("/units-of-measure"), [], "No se pudieron cargar las unidades.")

  return (
    <AppLayout title="Unidades de medida">
      <Head title="Unidades de medida" />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <PageHeading
          eyebrow="Catálogo"
          title="Unidades de medida"
          description="Unidades con las que se vende y se controla el stock de los productos."
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockIcon className="size-4 text-muted-foreground" /> Unidades del sistema
            </CardTitle>
            <CardDescription>
              Son fijas porque SUNAT y el cálculo de stock dependen de ellas. Bolsas, cajas o sacos se configuran como
              presentaciones o unidades de compra dentro de cada producto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !units ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Uso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(units ?? []).map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-mono">{unit.code}</TableCell>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{unit.type === "weight" ? "Peso" : "Conteo"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-normal text-muted-foreground">{USAGE[unit.code] ?? "—"}</TableCell>
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
