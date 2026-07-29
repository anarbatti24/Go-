/**
 * Geocode a free-text city / ZIP via OpenStreetMap Nominatim.
 */

export interface GeoPoint {
  lat: number
  lng: number
  label: string
}

export async function geocodeLocation(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    q: trimmed,
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!res.ok) return null

  const data = (await res.json()) as Array<{
    lat?: string
    lon?: string
    display_name?: string
  }>

  const hit = data[0]
  if (!hit?.lat || !hit?.lon) return null

  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return {
    lat,
    lng,
    label: hit.display_name || trimmed,
  }
}
