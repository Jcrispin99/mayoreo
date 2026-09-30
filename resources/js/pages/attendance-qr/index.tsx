import { Head, router, useForm } from "@inertiajs/react"
import {
  CrosshairIcon,
  DownloadIcon,
  MapPinIcon,
  PlusIcon,
  PrinterIcon,
  QrCodeIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"
import QRCode from "qrcode"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import "maplibre-gl/dist/maplibre-gl.css"

import { AttendanceLocationMap } from "@/components/attendance-location-map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppLayout } from "@/layouts/app-layout"

type AttendanceLocation = {
  id: number
  name: string
  latitude: string
  longitude: string
  radius_meters: number
  is_active: boolean
}

type StoreQr = {
  id: number
  code: string
  name: string
  address: string | null
  attendance_latitude: string | null
  attendance_longitude: string | null
  attendance_radius_meters: number
  attendance_locations: AttendanceLocation[]
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

function coordinate(value: string) {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type LocationForm = {
  name: string
  latitude: string
  longitude: string
  radius_meters: string
  is_active: boolean
}

function locationForm(location?: AttendanceLocation): LocationForm {
  return {
    name: location?.name ?? "",
    latitude: location?.latitude ?? "",
    longitude: location?.longitude ?? "",
    radius_meters: String(location?.radius_meters ?? 100),
    is_active: location?.is_active ?? true,
  }
}

function AttendanceLocationEditor({ store }: { store: StoreQr }) {
  const initialLocation = store.attendance_locations[0]
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(initialLocation?.id ?? null)
  const form = useForm<LocationForm>(locationForm(initialLocation))
  const [locationMessage, setLocationMessage] = useState("")
  const [recenterToken, setRecenterToken] = useState(0)
  const latitude = coordinate(form.data.latitude)
  const longitude = coordinate(form.data.longitude)
  const parsedRadius = Number(form.data.radius_meters)
  const radius = Number.isFinite(parsedRadius) ? Math.min(1000, Math.max(20, parsedRadius)) : 100
  const selectedLocation = store.attendance_locations.find((location) => location.id === selectedLocationId)

  function selectPoint(nextLatitude: number, nextLongitude: number) {
    form.setData("latitude", nextLatitude.toFixed(7))
    form.setData("longitude", nextLongitude.toFixed(7))
    setLocationMessage("")
  }

  function selectLocation(location: AttendanceLocation) {
    setSelectedLocationId(location.id)
    form.setData(locationForm(location))
    form.clearErrors()
    setLocationMessage("")
    setRecenterToken((value) => value + 1)
  }

  function startNewLocation() {
    setSelectedLocationId(null)
    form.setData(locationForm())
    form.clearErrors()
    setLocationMessage("")
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Este navegador no permite obtener la ubicación.")
      return
    }

    setLocationMessage("Obteniendo ubicación actual…")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        selectPoint(position.coords.latitude, position.coords.longitude)
        setRecenterToken((value) => value + 1)
        setLocationMessage(`Ubicación encontrada con una precisión aproximada de ${Math.round(position.coords.accuracy)} m.`)
      },
      () => setLocationMessage("No se pudo obtener la ubicación. Revisa el permiso del navegador o selecciona el punto en el mapa."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedLocationId === null) {
      form.post(`/attendance-qr/${store.id}/locations`, { preserveScroll: true })
      return
    }

    form.put(`/attendance-qr/${store.id}/locations/${selectedLocationId}`, { preserveScroll: true })
  }

  function removeLocation() {
    if (!selectedLocation || !window.confirm(`¿Eliminar el punto “${selectedLocation.name}”?`)) return

    router.delete(`/attendance-qr/${store.id}/locations/${selectedLocation.id}`, {
      preserveScroll: true,
      onSuccess: startNewLocation,
    })
  }

  return (
    <Card id="attendance-location-editor" className="scroll-mt-6 print:hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Puntos autorizados de asistencia</CardTitle>
            <CardDescription className="mt-1">
              El mismo QR funciona en cualquiera de los puntos activos de esta tienda.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={startNewLocation}>
            <PlusIcon />
            Agregar punto
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {store.attendance_locations.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {store.attendance_locations.map((location) => (
              <button
                className={`rounded-xl border p-4 text-left transition-colors ${selectedLocationId === location.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                key={location.id}
                onClick={() => selectLocation(location)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{location.name}</span>
                  <Badge variant={location.is_active ? "default" : "secondary"}>{location.is_active ? "Activo" : "Inactivo"}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Radio de {location.radius_meters} m</p>
              </button>
            ))}
          </div>
        ) : (
          <Alert>
            <MapPinIcon />
            <AlertTitle>Aún no hay puntos configurados</AlertTitle>
            <AlertDescription>Agrega el primer lugar desde donde se podrá marcar entrada y salida.</AlertDescription>
          </Alert>
        )}

        <form className="grid gap-5 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_20rem]" onSubmit={submit}>
          <div className="overflow-hidden rounded-xl">
            <AttendanceLocationMap
              latitude={latitude}
              longitude={longitude}
              radius={radius}
              recenterToken={recenterToken}
              onChange={selectPoint}
            />
          </div>

          <div className="flex flex-col gap-4">
            <Field data-invalid={Boolean(form.errors.name)}>
              <FieldLabel>Nombre del punto</FieldLabel>
              <Input
                aria-invalid={Boolean(form.errors.name)}
                maxLength={100}
                placeholder="Ej. Local principal o Almacén"
                value={form.data.name}
                onChange={(event) => form.setData("name", event.target.value)}
              />
              <FieldError>{form.errors.name}</FieldError>
            </Field>

            <Button type="button" variant="outline" onClick={useCurrentLocation}>
              <CrosshairIcon />
              Usar mi ubicación actual
            </Button>
            {locationMessage ? <p className="text-xs text-muted-foreground">{locationMessage}</p> : null}

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(form.errors.latitude)}>
                <FieldLabel>Latitud</FieldLabel>
                <Input
                  aria-invalid={Boolean(form.errors.latitude)}
                  inputMode="decimal"
                  step="0.0000001"
                  type="number"
                  value={form.data.latitude}
                  onChange={(event) => form.setData("latitude", event.target.value)}
                />
                <FieldError>{form.errors.latitude}</FieldError>
              </Field>
              <Field data-invalid={Boolean(form.errors.longitude)}>
                <FieldLabel>Longitud</FieldLabel>
                <Input
                  aria-invalid={Boolean(form.errors.longitude)}
                  inputMode="decimal"
                  step="0.0000001"
                  type="number"
                  value={form.data.longitude}
                  onChange={(event) => form.setData("longitude", event.target.value)}
                />
                <FieldError>{form.errors.longitude}</FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(form.errors.radius_meters)}>
              <FieldLabel>Radio permitido (metros)</FieldLabel>
              <Input
                aria-invalid={Boolean(form.errors.radius_meters)}
                max={1000}
                min={20}
                type="number"
                value={form.data.radius_meters}
                onChange={(event) => form.setData("radius_meters", event.target.value)}
              />
              <FieldDescription>Entre 20 y 1000 metros. Para un local pequeño, 50–100 m suele ser suficiente.</FieldDescription>
              <FieldError>{form.errors.radius_meters}</FieldError>
            </Field>

            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                checked={form.data.is_active}
                className="size-4 accent-primary"
                onChange={(event) => form.setData("is_active", event.target.checked)}
                type="checkbox"
              />
              <span><strong>Punto activo</strong><span className="block text-xs text-muted-foreground">Los trabajadores podrán marcar dentro de este radio.</span></span>
            </label>

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <Button disabled={form.processing || latitude === null || longitude === null || form.data.name.trim() === ""} type="submit">
                <SaveIcon />
                {selectedLocationId === null ? "Agregar punto" : "Guardar cambios"}
              </Button>
              {selectedLocation ? (
                <Button type="button" variant="destructive" onClick={removeLocation}>
                  <Trash2Icon />
                  Eliminar
                </Button>
              ) : null}
              {form.recentlySuccessful ? <span className="text-sm text-emerald-700">Punto guardado.</span> : null}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
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

  const activeLocations = store?.attendance_locations.filter((location) => location.is_active) ?? []
  const hasLegacyLocation = Boolean(store?.attendance_latitude && store.attendance_longitude)
  const configuredLocationCount = activeLocations.length || (hasLegacyLocation ? 1 : 0)
  const geofenceConfigured = configuredLocationCount > 0

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
                    <span className="block">La tienda no tiene coordenadas de asistencia. Configúralas antes de entregar el QR a los trabajadores.</span>
                    <Button
                      className="mt-3"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("attendance-location-editor")?.scrollIntoView({ behavior: "smooth" })}
                    >
                      <MapPinIcon />
                      Configurar en el mapa
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <ShieldCheckIcon />
                  <AlertTitle>Validación activa</AlertTitle>
                  <AlertDescription>
                    Aunque el QR no vence, cada marcación valida la sesión, el dispositivo y que el trabajador esté dentro de uno de los {configuredLocationCount} punto{configuredLocationCount === 1 ? "" : "s"} activo{configuredLocationCount === 1 ? "" : "s"}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {store ? <AttendanceLocationEditor key={store.id} store={store} /> : null}
      </div>
    </AppLayout>
  )
}
