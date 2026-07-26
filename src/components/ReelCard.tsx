/**
 * ReelCard — one full-screen discovery "reel"
 *
 * Vision: the Feed should feel like Instagram Reels / TikTok for places.
 * Each card is a single immersive frame: full-bleed portrait photo, gradient
 * for legibility, place story at the bottom, and a Save heart on the right —
 * the core loop of discovering → saving to My Roams.
 *
 * Important UX detail: the text overlay uses `pointer-events-none` so it never
 * steals taps from the Save button (that bug bit us once — don't reintroduce it).
 */

import { Heart, MapPin } from 'lucide-react'
import type { Place } from '../types'
import { priceLabel } from '../utils/price'

interface ReelCardProps {
  place: Place
  saved: boolean
  /** Wired to Zustand `toggleSave(place.id)` from the Feed page */
  onToggleSave: () => void
}

/**
 * Renders a single snap-scroll page of the Feed.
 * Parent (`Feed`) controls height + snap; this component owns the visuals.
 */
export function ReelCard({ place, saved, onToggleSave }: ReelCardProps) {
  return (
    <article className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <img
        src={place.image}
        alt={place.name}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {/* Darken edges so white text stays readable on any photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

      {/* Place story — non-interactive so Save stays clickable */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pb-24 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {place.category}
        </p>
        <h2 className="pr-16 text-2xl font-bold leading-tight drop-shadow-sm">{place.name}</h2>
        <p className="line-clamp-2 pr-16 text-sm leading-relaxed text-white/90">
          {place.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-white/85">
          <span aria-label={`Price level ${place.price}`}>{priceLabel(place.price)}</span>
          <span>·</span>
          <span>{place.distance}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {place.location}
          </span>
        </div>
      </div>

      {/* Primary action: save this place into My Roams */}
      <div className="absolute right-3 bottom-28 z-30 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleSave()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-30 flex flex-col items-center gap-1 rounded-full transition active:scale-95"
          aria-label={saved ? 'Unsave place' : 'Save place'}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm ring-1 ring-white/20">
            <Heart
              className={`h-7 w-7 transition-colors ${saved ? 'fill-primary text-primary' : 'text-white'}`}
              strokeWidth={2}
            />
          </span>
          <span className="text-xs font-medium text-white drop-shadow">
            {saved ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>
    </article>
  )
}
