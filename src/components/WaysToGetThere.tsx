/**
 * WaysToGetThere — accordion on the results winner card
 *
 * Bridges “we picked a spot” → “let’s go”: open Maps directions or
 * pre-fill an Uber ride to the destination.
 */

import { useState } from 'react'
import { Car, ChevronDown, Loader2, MapPinned } from 'lucide-react'
import { geocodeLocation } from '../api/geocode'
import type { Place } from '../types'
import {
  destinationQuery,
  mapsDirectionsUrl,
  uberRideUrl,
} from '../utils/travelLinks'

interface WaysToGetThereProps {
  place: Place
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function WaysToGetThere({ place }: WaysToGetThereProps) {
  const [open, setOpen] = useState(false)
  const [uberBusy, setUberBusy] = useState(false)

  const handleMaps = () => {
    openExternal(mapsDirectionsUrl(place))
  }

  const handleUber = async () => {
    if (uberBusy) return
    setUberBusy(true)
    try {
      const coords = await geocodeLocation(destinationQuery(place))
      openExternal(uberRideUrl(place, coords))
    } catch {
      openExternal(uberRideUrl(place, null))
    } finally {
      setUberBusy(false)
    }
  }

  return (
    <div className="ways-to-get-there mt-4 overflow-hidden rounded-xl border border-green-200/80 bg-white/80">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition hover:bg-green-50/60"
      >
        <span className="text-sm font-semibold text-gray-900">
          Ways to get there
        </span>
        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 text-green-700 transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden
        />
      </button>

      <div
        className={[
          'ways-to-get-there__panel',
          open ? 'ways-to-get-there__panel--open' : '',
        ].join(' ')}
      >
        <div className="ways-to-get-there__inner space-y-2 px-3 pb-3">
          <button
            type="button"
            onClick={handleMaps}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3 text-left transition hover:bg-gray-50 active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinned className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">
                Open in Maps
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                Start directions to {place.name}
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={uberBusy}
            onClick={() => void handleUber()}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3 text-left transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
              {uberBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Car className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">
                {uberBusy ? 'Setting up Uber…' : 'Ride with Uber'}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                Dropoff set to {place.location}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
