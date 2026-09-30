import type { FeatureCollection, Geometry } from "geojson"
import {
  GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { useEffect, useRef } from "react"

setWorkerUrl(workerUrl)

type AttendanceLocationMapProps = {
  latitude: number | null
  longitude: number | null
  radius: number
  recenterToken: number
  onChange: (latitude: number, longitude: number) => void
}

const PERU_CENTER: [number, number] = [-75.0152, -9.19]
const SELECTION_SOURCE = "attendance-selection"

function circleCoordinates(latitude: number, longitude: number, radius: number) {
  const latitudeRadians = latitude * Math.PI / 180

  return Array.from({ length: 65 }, (_, index): [number, number] => {
    const angle = index / 64 * Math.PI * 2
    const latitudeDelta = radius / 111_320 * Math.cos(angle)
    const longitudeDelta = radius / (111_320 * Math.cos(latitudeRadians)) * Math.sin(angle)

    return [longitude + longitudeDelta, latitude + latitudeDelta]
  })
}

function selectionData(latitude: number | null, longitude: number | null, radius: number): FeatureCollection<Geometry> {
  if (latitude === null || longitude === null) {
    return { type: "FeatureCollection", features: [] }
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "area" },
        geometry: {
          type: "Polygon",
          coordinates: [circleCoordinates(latitude, longitude, radius)],
        },
      },
      {
        type: "Feature",
        properties: { kind: "point" },
        geometry: { type: "Point", coordinates: [longitude, latitude] },
      },
    ],
  }
}

function addSelectionLayers(map: MapLibreMap, data: FeatureCollection<Geometry>) {
  map.addSource(SELECTION_SOURCE, { type: "geojson", data })
  map.addLayer({
    id: "attendance-area-fill",
    type: "fill",
    source: SELECTION_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#ef4444", "fill-opacity": 0.14 },
  })
  map.addLayer({
    id: "attendance-area-line",
    type: "line",
    source: SELECTION_SOURCE,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#b4232d", "line-width": 2 },
  })
  map.addLayer({
    id: "attendance-point",
    type: "circle",
    source: SELECTION_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 8,
      "circle-color": "#b4232d",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  })
}

export function AttendanceLocationMap({
  latitude,
  longitude,
  radius,
  recenterToken,
  onChange,
}: AttendanceLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const onChangeRef = useRef(onChange)
  const selectionRef = useRef({ latitude, longitude, radius })
  selectionRef.current = { latitude, longitude, radius }

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const hasPoint = latitude !== null && longitude !== null
    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: hasPoint ? [longitude, latitude] : PERU_CENTER,
      zoom: hasPoint ? 17 : 5,
    })

    map.addControl(new NavigationControl({ showCompass: false }), "top-left")
    map.on("click", (event) => {
      onChangeRef.current(event.lngLat.lat, event.lngLat.lng)
    })
    map.on("load", () => {
      const current = selectionRef.current
      addSelectionLayers(map, selectionData(current.latitude, current.longitude, current.radius))
    })
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const source = mapRef.current?.getSource(SELECTION_SOURCE)
    if (source instanceof GeoJSONSource) {
      source.setData(selectionData(latitude, longitude, radius))
    }
  }, [latitude, longitude, radius])

  useEffect(() => {
    if (latitude === null || longitude === null) return
    mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 18 })
  }, [recenterToken])

  return <div ref={containerRef} className="h-80 w-full rounded-xl border sm:h-96" />
}
