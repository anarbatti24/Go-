/**
 * ReelCard — one full-screen discovery "reel"
 *
 * Vision: Instagram Reels energy for real nearby places (Yelp) and movies (TMDB).
 * Footer metadata adapts: cuisine + distance + price for food, runtime + rating
 * + genre for movies.
 */

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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pb-24 text-white">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
          {isMovie ? (
            <Clapperboard className="h-3.5 w-3.5" />
          ) : (
            <Utensils className="h-3.5 w-3.5" />
          )}
          {categoryLabel}
        </p>
        <h2 className="pr-16 text-2xl font-bold leading-tight drop-shadow-sm">
          {place.name}
        </h2>
        <p className="line-clamp-2 pr-16 text-sm leading-relaxed text-white/90">
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
                  <span>{place.genres.slice(0, 2).join(', ')}</span>
                </>
              ) : null}
            </>
          ) : (
            <>
              {place.price ? (
                <span aria-label={`Price level ${place.price}`}>
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
                <span className="line-clamp-1 max-w-[11rem]">{place.location}</span>
              </span>
            </>
          )}
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
