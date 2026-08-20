/**
 * Travel radius map — pin + circle sized to the user's max travel distance.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { geocodeLocation, type GeoPoint } from '../api/geocode'

// Vite needs explicit marker URLs — Leaflet's default paths break under bundlers.
const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function FitTravelCircle({
  center,
  radiusMeters,
}: {
  center: [number, number]
  radiusMeters: number
}) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.latLng(center[0], center[1]).toBounds(
      Math.max(radiusMeters, 250),
    )
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 })
  }, [map, center, radiusMeters])

  return null
}

interface TravelRadiusMapProps {
  location: string
  km: number
  /** When set (e.g. from Photon autocomplete), skip a second geocode. */
  lat?: number
  lng?: number
}

export function TravelRadiusMap({
  location,
  km,
  lat,
  lng,
}: TravelRadiusMapProps) {
  const [point, setPoint] = useState<GeoPoint | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      setPoint({ lat, lng, label: location })
      setStatus('ready')
      return
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await geocodeLocation(location)
        if (cancelled) return
        if (!result) {
          setPoint(null)
          setStatus('error')
          return
        }
        setPoint(result)
        setStatus('ready')
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [location, lat, lng])

  const center = useMemo<[number, number] | null>(
    () => (point ? [point.lat, point.lng] : null),
    [point],
  )

  const radiusMeters = Math.max(0, km) * 1000

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative h-52 w-full bg-gray-100">
        {status === 'loading' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted">
            Locating on the map…
          </div>
        ) : null}
        {status === 'error' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-muted">
            Couldn’t place that on the map — the slider still sets your radius.
          </div>
        ) : null}
        {center ? (
          <MapContainer
            key={`${center[0]}-${center[1]}`}
            center={center}
            zoom={11}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
            dragging
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            />
            <Marker position={center} icon={pinIcon} />
            {km > 0 ? (
              <Circle
                center={center}
                radius={radiusMeters}
                pathOptions={{
                  color: '#ff6b6b',
                  fillColor: '#ff6b6b',
                  fillOpacity: 0.18,
                  weight: 2,
                }}
              />
            ) : null}
            <FitTravelCircle center={center} radiusMeters={radiusMeters} />
          </MapContainer>
        ) : null}
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted">
        {km <= 0
          ? 'Right where you are — ultra-local picks only.'
          : `Travel circle: about ${km} km out.`}
      </p>
    </div>
  )
}
