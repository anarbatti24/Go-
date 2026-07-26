/**
 * My Roams (`/roams`) — personal saved-place library
 *
 * Vision: after discovering places in the Feed, users land here to revisit what
 * they hearted. Think of it as a private wishlist that later feeds Event Setup
 * when a group needs candidate venues.
 *
 * Empty state is intentional and encouraging — Go! only works if people explore
 * first, so we nudge them back to the Feed instead of showing a blank void.
 */

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Modal } from '../components/Modal'
import { PlaceCard } from '../components/PlaceCard'
import { useStore } from '../store/useStore'
import type { Place } from '../types'
import { priceLabel } from '../utils/price'

/** Grid of saved places with an optional details modal on tap. */
export function Roams() {
  // Subscribe to savedIds so this screen updates when hearts change
  const savedIds = useStore((s) => s.savedIds)
  const toggleSave = useStore((s) => s.toggleSave)
  const getSavedPlaces = useStore((s) => s.getSavedPlaces)
  const savedPlaces = getSavedPlaces()

  /** Which place's detail sheet is open (null = closed). */
  const [selected, setSelected] = useState<Place | null>(null)

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My Roams</h1>
        <p className="mt-1 text-sm text-muted">Places you&apos;ve saved for later.</p>
      </header>

      {savedPlaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface px-6 py-16 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-base font-medium text-gray-800">No roams yet. Start exploring!</p>
          <p className="mt-2 text-sm text-muted">Tap the heart on Feed cards to save places here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {savedPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              saved={savedIds.includes(place.id)}
              onToggleSave={() => toggleSave(place.id)}
              onClick={() => setSelected(place)}
            />
          ))}
        </div>
      )}

      {/* Detail sheet — richer copy than the compact card can show */}
      {selected ? (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <img
            src={selected.image}
            alt={selected.name}
            className="mb-4 h-44 w-full rounded-xl object-cover"
          />
          <p className="text-sm leading-relaxed text-gray-700">{selected.description}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Price</dt>
              <dd className="font-medium">{priceLabel(selected.price)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Distance</dt>
              <dd className="font-medium">{selected.distance}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Location</dt>
              <dd className="flex items-center gap-1 text-right font-medium">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                {selected.location}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Category</dt>
              <dd className="font-medium">{selected.category}</dd>
            </div>
          </dl>
        </Modal>
      ) : null}
    </div>
  )
}
