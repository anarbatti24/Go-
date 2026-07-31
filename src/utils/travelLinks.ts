/**
 * Deep links so the results screen can hand off to Maps / Uber.
 */

import type { Place } from '../types'
import type { GeoPoint } from '../api/geocode'

/** Query string used as a Maps / Uber destination. */
export function destinationQuery(place: Place): string {
  const name = place.name.trim()
  const location = place.location.trim()
  if (name && location) return `${name}, ${location}`
  return name || location
}

/** Google Maps turn-by-turn with destination pre-filled. */
export function mapsDirectionsUrl(place: Place): string {
  const destination = destinationQuery(place)
  const params = new URLSearchParams({
    api: '1',
    destination,
  })
  return `https://www.google.com/maps/dir/?${params}`
}

/**
 * Uber universal link — opens the app when installed, otherwise m.uber.com.
 * Nickname or formatted address is required for dropoff to populate.
 */
export function uberRideUrl(place: Place, coords?: GeoPoint | null): string {
  const nickname = place.name.trim() || 'Destination'
  const formatted = destinationQuery(place)
  const params = new URLSearchParams()
  params.set('action', 'setPickup')
  params.set('pickup', 'my_location')
  params.set('dropoff[nickname]', nickname)
  params.set('dropoff[formatted_address]', formatted)

  if (coords) {
    params.set('dropoff[latitude]', String(coords.lat))
    params.set('dropoff[longitude]', String(coords.lng))
  }

  return `https://m.uber.com/ul/?${params}`
}
