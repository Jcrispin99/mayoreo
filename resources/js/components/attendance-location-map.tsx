import L from "leaflet"
import { useEffect, useRef } from "react"

type AttendanceLocationMapProps = {
  latitude: number | null
  longitude: number | null
  radius: number
  recenterToken: number
  onChange: (latitude: number, longitude: number) => void
}

const PERU_CENTER: L.LatLngExpression = [-9.19, -75.0152]

export function AttendanceLocationMap({
  latitude,
  longitude,
  radius,
  recenterToken,
  onChange,
}: AttendanceLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const selectionLayerRef = useRef<L.LayerGroup | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialPosition: L.LatLngExpression = latitude !== null && longitude !== null
      ? [latitude, longitude]
      : PERU_CENTER
    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      initialPosition,
      latitude !== null && longitude !== null ? 17 : 6,
    )

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const selectionLayer = L.layerGroup().addTo(map)
    map.on("click", (event: L.LeafletMouseEvent) => {
      onChangeRef.current(event.latlng.lat, event.latlng.lng)
    })

    mapRef.current = map
    selectionLayerRef.current = selectionLayer

    return () => {
      map.remove()
      mapRef.current = null
      selectionLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const selectionLayer = selectionLayerRef.current
    if (!selectionLayer) return

    selectionLayer.clearLayers()
    if (latitude === null || longitude === null) return

    const point: L.LatLngExpression = [latitude, longitude]
    L.circle(point, {
      radius,
      color: "#b4232d",
      fillColor: "#ef4444",
      fillOpacity: 0.12,
      weight: 2,
    }).addTo(selectionLayer)
    L.circleMarker(point, {
      radius: 8,
      color: "#ffffff",
      fillColor: "#b4232d",
      fillOpacity: 1,
      weight: 3,
    }).addTo(selectionLayer)
  }, [latitude, longitude, radius])

  useEffect(() => {
    if (latitude === null || longitude === null) return
    mapRef.current?.setView([latitude, longitude], 18)
  }, [recenterToken])

  return <div ref={containerRef} className="h-80 w-full rounded-xl border sm:h-96" />
}
