/**
 * PlaceCard — compact library / list card for My Roams
 */

import { Heart } from 'lucide-react'
import type { Place } from '../types'
import { priceLabel, ratingLabel, runtimeLabel } from '../utils/price'

interface PlaceCardProps {
  place: Place
  saved: boolean
  onToggleSave: () => void
  onClick?: () => void
}

export function PlaceCard({ place, saved, onToggleSave, onClick }: PlaceCardProps) {
  const isMovie = place.source === 'tmdb'
  const meta = isMovie
    ? [ratingLabel(place.rating, place.source), runtimeLabel(place.runtimeMinutes)]
        .filter(Boolean)
        .join(' · ')
    : [place.price ? priceLabel(place.price) : null, place.distance]
        .filter(Boolean)
        .join(' · ')

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
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {isMovie ? 'Movie' : place.cuisine || place.category}
        </span>
      </div>
      <div className="space-y-1 p-3.5">
        <h3 className="line-clamp-1 font-semibold text-gray-900">{place.name}</h3>
        <div className="flex items-center justify-between gap-2 text-sm text-muted">
          <span className="truncate">{meta || place.category}</span>
        </div>
      </div>
    </article>
  )
}
