/**
 * ReelCard — one full-screen discovery "reel"
 *
 * Vision: Instagram Reels energy for real nearby places (Yelp) and movies (TMDB).
 * Footer metadata adapts: cuisine + distance + price for food, runtime + rating
 * + genre for movies. Hovering (or tapping) the info panel darkens the backdrop
 * and expands the synopsis so nothing is cut off.
 */

import { useState } from 'react'
import { Clapperboard, Heart, MapPin, Star, Utensils } from 'lucide-react'
import type { Place } from '../types'
import { priceLabel, ratingLabel, runtimeLabel } from '../utils/price'

interface ReelCardProps {
  place: Place
  saved: boolean
  /** Highlight when this card was boosted by onboarding interests. */
  forYou?: boolean
  onToggleSave: () => void
}

export function ReelCard({
  place,
  saved,
  forYou = false,
  onToggleSave,
}: ReelCardProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const isMovie = place.source === 'tmdb'
  const rating = ratingLabel(place.rating, place.source)
  const runtime = runtimeLabel(place.runtimeMinutes)
  const categoryLabel = place.cuisine || place.category

  return (
    <article className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <img
        src={place.image}
        alt={place.name}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

      {forYou ? (
        <span className="absolute left-3 top-14 z-20 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md">
          For you
        </span>
      ) : null}

      <div
        className={[
          'reel-info absolute inset-x-0 bottom-0 z-10 p-4 pb-24 text-white',
          infoOpen ? 'reel-info--open' : '',
        ].join(' ')}
        onMouseEnter={() => setInfoOpen(true)}
        onMouseLeave={() => setInfoOpen(false)}
        onClick={() => {
          // Touch devices have no hover — tap to expand / collapse.
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return
          }
          setInfoOpen((v) => !v)
        }}
        role="region"
        aria-label={`Details for ${place.name}`}
      >
        <div className="reel-info__panel space-y-2 rounded-2xl p-3.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
            {isMovie ? (
              <Clapperboard className="h-3.5 w-3.5" />
            ) : (
              <Utensils className="h-3.5 w-3.5" />
            )}
            {categoryLabel}
          </p>
          <h2 className="pr-14 text-2xl font-bold leading-tight drop-shadow-sm">
            {place.name}
          </h2>
          <p
            className={[
              'pr-14 text-sm leading-relaxed text-white/90',
              infoOpen ? 'reel-info__desc--open' : 'line-clamp-2',
            ].join(' ')}
          >
            {place.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-white/85">
            {isMovie ? (
              <>
                {rating ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                    {rating}
                  </span>
                ) : null}
                {runtime ? (
                  <>
                    <span>·</span>
                    <span>{runtime}</span>
                  </>
                ) : null}
                {place.genres && place.genres.length > 1 ? (
                  <>
                    <span>·</span>
                    <span>
                      {infoOpen
                        ? place.genres.join(', ')
                        : place.genres.slice(0, 2).join(', ')}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {place.price ? (
                  <span
                    className="font-medium tracking-wide"
                    aria-label={`Price level ${place.price}`}
                  >
                    {priceLabel(place.price)}
                  </span>
                ) : null}
                {place.price ? <span>·</span> : null}
                <span>{place.distance}</span>
                {rating ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                      {rating}
                    </span>
                  </>
                ) : null}
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span
                    className={
                      infoOpen ? 'max-w-full' : 'line-clamp-1 max-w-[11rem]'
                    }
                  >
                    {place.location}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

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
