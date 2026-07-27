/**
 * Client for `/api/discover` — nearby places + movies for the Feed.
 */

import type { Place } from '../types'

export interface DiscoverResponse {
  places: Place[]
  sources: { yelp: boolean; tmdb: boolean; fallback: boolean }
  message?: string
  errors?: string[]
}

export async function discoverPlaces(
  location: string,
): Promise<DiscoverResponse> {
  const params = new URLSearchParams({ location: location.trim() })
  const res = await fetch(`/api/discover?${params}`)
  const data = (await res.json()) as DiscoverResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Discover failed (${res.status})`)
  }
  return data
}
