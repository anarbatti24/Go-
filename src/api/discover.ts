/**
 * Client for `/api/discover` — nearby places, events, and movies for the Feed.
 */

import type { Place } from '../types'

export interface DiscoverResponse {
  places: Place[]
  sources: {
    yelp: boolean
    tmdb: boolean
    overpass?: boolean
    ticketmaster?: boolean
    fallback: boolean
  }
  radiusKm?: number
  interests?: string[]
  message?: string
  errors?: string[]
}

export async function discoverPlaces(
  location: string,
  radiusKm?: number,
  interests?: string[],
): Promise<DiscoverResponse> {
  const params = new URLSearchParams({ location: location.trim() })
  if (typeof radiusKm === 'number' && Number.isFinite(radiusKm)) {
    params.set('radiusKm', String(radiusKm))
  }
  if (interests && interests.length > 0) {
    params.set('interests', interests.join(','))
  }
  const res = await fetch(`/api/discover?${params}`)
  const data = (await res.json()) as DiscoverResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Discover failed (${res.status})`)
  }
  return data
}
