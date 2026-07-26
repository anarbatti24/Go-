/**
 * PlaceCard — compact library / list card
 *
 * Vision: My Roams (and similar grids) need a denser, browsable layout than the
 * full-screen Feed reels. This card is the "album cover" version of a place:
 * image, name, price, distance, and a heart that syncs with the same `savedIds`
 * store the Reels Save button uses.
 *
 * Optional `onClick` opens a details modal without fighting the heart control
 * (`stopPropagation` on the heart keeps save taps from opening the modal).
 */

import { Heart } from 'lucide-react'
import type { Place } from '../types'
import { priceLabel } from '../utils/price'

interface PlaceCardProps {
  place: Place
  /** Whether this place is currently in My Roams */
  saved: boolean
  onToggleSave: () => void
  /** Optional: open details when the card body is tapped */
  onClick?: () => void
}

/** Grid-friendly place tile used outside of the Reels Feed. */
export function PlaceCard({ place, saved, onToggleSave, onClick }: PlaceCardProps) {
  return (
    <article
      className={[
        'overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-black/5 transition hover:shadow-md',
        onClick ? 'cursor-pointer' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={place.image}
          alt={place.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <button
          type="button"
          onClick={(e) => {
            // Don't bubble to the card's onClick (details modal)
            e.stopPropagation()
            onToggleSave()
          }}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur transition hover:scale-105"
          aria-label={saved ? 'Unsave place' : 'Save place'}
        >
          <Heart
            className={`h-5 w-5 ${saved ? 'fill-primary text-primary' : 'text-gray-500'}`}
            strokeWidth={2}
          />
        </button>
      </div>
      <div className="space-y-1 p-3.5">
        <h3 className="line-clamp-1 font-semibold text-gray-900">{place.name}</h3>
        <div className="flex items-center justify-between gap-2 text-sm text-muted">
          <span aria-label={`Price level ${place.price}`}>{priceLabel(place.price)}</span>
          <span>{place.distance}</span>
        </div>
      </div>
    </article>
  )
}
