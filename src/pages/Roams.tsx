/**
 * Go-Tos (`/go-tos`) — personal saved-place library
 *
 * Places you’ve hearted from the Feed — your go-to spots for later hangouts.
 */

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Modal } from '../components/Modal'
import { PlaceCard } from '../components/PlaceCard'
import { useStore } from '../store/useStore'
import type { Place } from '../types'
import { priceLabel, ratingLabel, runtimeLabel } from '../utils/price'

export function Roams() {
  const savedIds = useStore((s) => s.savedIds)
  const toggleSave = useStore((s) => s.toggleSave)
  const getSavedPlaces = useStore((s) => s.getSavedPlaces)
  const savedPlaces = getSavedPlaces()

  const [selected, setSelected] = useState<Place | null>(null)

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Go-Tos</h1>
        <p className="mt-1 text-sm text-muted">
          Spots you&apos;ve saved — ready whenever your group wants to Go!
        </p>
      </header>

      {savedPlaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface px-6 py-16 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-base font-medium text-gray-800">
            No Go-Tos yet. Start exploring!
          </p>
          <p className="mt-2 text-sm text-muted">
            Tap the heart on Feed cards to save spots here.
          </p>
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

      {selected ? (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <img
            src={selected.image}
            alt={selected.name}
            className="mb-4 h-44 w-full rounded-xl object-cover"
          />
          <p className="text-sm leading-relaxed text-gray-700">
            {selected.description}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            {selected.source === 'tmdb' ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Rating</dt>
                  <dd className="font-medium">
                    {ratingLabel(selected.rating, selected.source) ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Runtime</dt>
                  <dd className="font-medium">
                    {runtimeLabel(selected.runtimeMinutes) ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Genres</dt>
                  <dd className="text-right font-medium">
                    {(selected.genres ?? [selected.category]).join(', ')}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Price</dt>
                  <dd className="font-medium">{priceLabel(selected.price)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Distance</dt>
                  <dd className="font-medium">{selected.distance}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Type</dt>
                  <dd className="font-medium">
                    {selected.cuisine || selected.category}
                  </dd>
                </div>
                {selected.rating != null ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Rating</dt>
                    <dd className="font-medium">
                      {ratingLabel(selected.rating, selected.source)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">Location</dt>
                  <dd className="flex items-center gap-1 text-right font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {selected.location}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </Modal>
      ) : null}
    </div>
  )
}
