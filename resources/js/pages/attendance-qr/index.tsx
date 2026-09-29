import { Head, router } from "@inertiajs/react"
import {
  DownloadIcon,
  MapPinIcon,
  PrinterIcon,
  QrCodeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react"
import QRCode from "qrcode"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppLayout } from "@/layouts/app-layout"

type StoreQr = {
  id: number
  code: string
  name: string
  address: string | null
  attendance_latitude: string | null
  attendance_longitude: string | null
  attendance_radius_meters: number
  configured: boolean
  recoverable: boolean
  payload: string | null
  rotated_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return "Aún no generado"

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export default function AttendanceQrIndex({ stores }: { stores: StoreQr[] }) {
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(stores[0]?.id ?? null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  const store = useMemo(
    () => stores.find((item) => item.id === selectedStoreId) ?? stores[0] ?? null,
    [selectedStoreId, stores],
  )

  useEffect(() => {
    let cancelled = false

    if (!store?.payload) {
      setQrDataUrl(null)
      return
    }

    setQrDataUrl(null)
    setIsGeneratingImage(true)
    QRCode.toDataURL(store.payload, {
      errorCorrectionLevel: "H",
      margin: 3,
      width: 1200,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((value) => {
        if (!cancelled) setQrDataUrl(value)
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingImage(false)
      })

    return () => {
      cancelled = true
    }
  }, [store?.payload])

  function rotateQr() {
    if (!store) return

    if (store.configured && !window.confirm("El QR impreso anteriormente dejará de funcionar. ¿Deseas generar uno nuevo?")) {
      return
    }

    setIsRotating(true)
    router.post(`/attendance-qr/${store.id}/rotate`, {}, {
      preserveScroll: true,
      onFinish: () => setIsRotating(false),
    })
  }

  function downloadQr() {
    if (!store || !qrDataUrl) return

    const link = document.createElement("a")
    link.href = qrDataUrl
    link.download = `qr-asistencia-${safeFileName(store.code || store.name)}.png`
    link.click()
  }

  const geofenceConfigured = Boolean(store?.attendance_latitude && store.attendance_longitude)

  return (
    <AppLayout title="QR de asistencia">
      <Head title="QR de asistencia" />

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body * { visibility: hidden !important; }
          #attendance-qr-print, #attendance-qr-print * { visibility: visible !important; }
          #attendance-qr-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Control de asistencia</p>
          <h1 className="text-2xl font-semibold tracking-tight">QR permanente por tienda</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Imprímelo una sola vez. Los trabajadores usan el mismo código para registrar entrada y salida durante el día.
          </p>
        </div>

        {stores.length === 0 ? (
          <Alert>
            <QrCodeIcon />
            <AlertTitle>No hay tiendas activas</AlertTitle>
            <AlertDescription>Activa o registra una tienda para poder generar su QR de asistencia.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card id="attendance-qr-print" className="overflow-hidden">
              <CardHeader className="border-b text-center">
                <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <QrCodeIcon className="size-6" />
                </div>
                <CardTitle className="text-2xl">Registro de asistencia</CardTitle>
                <CardDescription>Escanea este código desde la aplicación Mayoreo</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
                <div className="w-full max-w-72 rounded-2xl border bg-white p-4">
                  {qrDataUrl ? (
                    <img className="aspect-square w-full" src={qrDataUrl} alt={`QR de asistencia de ${store?.name ?? "la tienda"}`} />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-xl bg-muted p-6 text-sm text-muted-foreground">
                      {isGeneratingImage ? "Preparando QR…" : "Genera el QR para poder imprimirlo"}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xl font-semibold">{store?.name}</p>
                  <p className="text-sm font-medium text-muted-foreground">Tienda {store?.code}</p>
                  {store?.address ? (
                    <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <MapPinIcon className="size-4" />
                      {store.address}
                    </p>
                  ) : null}
                </div>

                <div className="max-w-md rounded-xl bg-muted/60 px-5 py-4 text-sm">
                  <p className="font-medium">Entrada y salida con el mismo QR</p>
                  <p className="mt-1 text-muted-foreground">
                    Inicia sesión en tu celular, abre Asistencia y escanea. El sistema identificará automáticamente si corresponde entrada o salida.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 print:hidden">
              <Card>
                <CardHeader>
                  <CardTitle>Preparar impresión</CardTitle>
                  <CardDescription>Selecciona la tienda y descarga o imprime su código.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Select
                    value={store?.id ?? null}
                    onValueChange={(value) => setSelectedStoreId(value === null ? null : Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una tienda" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name} ({item.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={store?.payload ? "default" : "secondary"}>
                      {store?.payload ? "QR vigente" : "Sin QR"}
                    </Badge>
                    {store?.payload ? <Badge variant="outline">Sin vencimiento</Badge> : null}
                  </div>

                  <p className="text-xs text-muted-foreground">Última generación: {formatDate(store?.rotated_at ?? null)}</p>

                  <Button disabled={!qrDataUrl} onClick={() => window.print()}>
                    <PrinterIcon />
                    Imprimir QR
                  </Button>
                  <Button disabled={!qrDataUrl} variant="outline" onClick={downloadQr}>
                    <DownloadIcon />
                    Descargar PNG
                  </Button>
                  <Button disabled={isRotating} variant={store?.configured ? "destructive" : "secondary"} onClick={rotateQr}>
                    <RefreshCwIcon className={isRotating ? "animate-spin" : undefined} />
                    {store?.configured ? "Invalidar y generar otro" : "Generar QR"}
                  </Button>
                </CardContent>
              </Card>

              {!geofenceConfigured ? (
                <Alert variant="destructive">
                  <MapPinIcon />
                  <AlertTitle>Ubicación pendiente</AlertTitle>
                  <AlertDescription>
                    La tienda no tiene coordenadas de asistencia. Configúralas antes de entregar el QR a los trabajadores.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <ShieldCheckIcon />
                  <AlertTitle>Validación activa</AlertTitle>
                  <AlertDescription>
                    Aunque el QR no vence, cada marcación valida la sesión, el dispositivo y una distancia máxima de {store?.attendance_radius_meters} m de la tienda.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
