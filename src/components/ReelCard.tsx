/**
 * ReelCard — one full-screen discovery "reel"
 *
 * Vision: Instagram Reels energy for real nearby places, events, and movies.
 * Footer metadata adapts by source. Hovering (or tapping) the info panel darkens
 * the backdrop and expands the synopsis. Save stays bottom-right until details
 * open, then rises to sit just above the dark panel’s top edge.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Clapperboard,
  Heart,
  MapPin,
  Music2,
  Star,
  Trees,
  Utensils,
} from 'lucide-react'
import type { Place } from '../types'
import { priceLabel, ratingLabel, runtimeLabel } from '../utils/price'

/** Default CSS `bottom` for the Save control (matches former `bottom-28`). */
const SAVE_REST_BOTTOM_PX = 112
/** Gap between the Save control and the top of the dark detail panel. */
const SAVE_PANEL_GAP_PX = 10
/** Right strip reserved for Save — hovering here alone won't open details. */
const SAVE_HOVER_GUTTER_PX = 76

interface ReelCardProps {
  place: Place
  saved: boolean
  /** Highlight when this card was boosted by onboarding interests. */
  forYou?: boolean
  onToggleSave: () => void
}

function CategoryIcon({ place }: { place: Place }) {
  if (place.source === 'tmdb') return <Clapperboard className="h-3.5 w-3.5" />
  if (place.source === 'ticketmaster') return <Music2 className="h-3.5 w-3.5" />
  if (place.source === 'overpass') return <Trees className="h-3.5 w-3.5" />
  return <Utensils className="h-3.5 w-3.5" />
}

export function ReelCard({
  place,
  saved,
  forYou = false,
  onToggleSave,
}: ReelCardProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [saveBottomPx, setSaveBottomPx] = useState(SAVE_REST_BOTTOM_PX)
  const cardRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<number | null>(null)
  const isMovie = place.source === 'tmdb'
  const rating = ratingLabel(place.rating, place.source)
  const runtime = runtimeLabel(place.runtimeMinutes)
  const categoryLabel = place.cuisine || place.category

  const syncSavePosition = useCallback(() => {
    const card = cardRef.current
    const panel = panelRef.current
    if (!infoOpen || !card || !panel) {
      setSaveBottomPx(SAVE_REST_BOTTOM_PX)
      return
    }

    const cardRect = card.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    // Distance from card bottom → panel top, plus a small gap so Save clears the border.
    const next = Math.round(cardRect.bottom - panelRect.top + SAVE_PANEL_GAP_PX)
    setSaveBottomPx(Math.max(SAVE_REST_BOTTOM_PX, next))
  }, [infoOpen])

  useLayoutEffect(() => {
    syncSavePosition()
  }, [syncSavePosition, infoOpen, place.description, place.name])

  useEffect(() => {
    if (!infoOpen) return
    const panel = panelRef.current
    if (!panel) return

    const ro = new ResizeObserver(() => syncSavePosition())
    ro.observe(panel)
    window.addEventListener('resize', syncSavePosition)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncSavePosition)
    }
  }, [infoOpen, syncSavePosition])

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const keepInfoOpen = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setInfoOpen(true)
  }

  /** True when the pointer is in the Save column (right edge), not the details copy. */
  const isInSaveGutter = (clientX: number) => {
    const card = cardRef.current
    if (!card) return false
    const rect = card.getBoundingClientRect()
    return clientX > rect.right - SAVE_HOVER_GUTTER_PX
  }

  /**
   * Open details only when hovering the content area (left of Save).
   * Save strip alone must not open the panel — but once open, full width is fine.
   */
  const handleInfoPointer = (clientX: number) => {
    if (infoOpen) {
      keepInfoOpen()
      return
    }
    if (isInSaveGutter(clientX)) return
    keepInfoOpen()
  }

  /** Keep an already-open panel open (e.g. moving onto Save) — never open from Save alone. */
  const keepInfoOpenIfAlready = () => {
    if (!infoOpen) return
    keepInfoOpen()
  }

  const scheduleInfoClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setInfoOpen(false)
      closeTimer.current = null
    }, 140)
  }

  return (
    <article
      ref={cardRef}
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black"
    >
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
        onMouseEnter={(e) => handleInfoPointer(e.clientX)}
        onMouseMove={(e) => {
          // Approaching from the Save strip into content should still open details.
          if (!infoOpen) handleInfoPointer(e.clientX)
        }}
        onMouseLeave={scheduleInfoClose}
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
        <div
          ref={panelRef}
          className="reel-info__panel space-y-2 rounded-2xl p-3.5"
        >
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
            <CategoryIcon place={place} />
            {categoryLabel}
          </p>
          <h2 className="pr-16 text-2xl font-bold leading-tight drop-shadow-sm">
            {place.name}
          </h2>
          <p
            className={[
              'pr-4 text-sm leading-relaxed text-white/90',
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

      <div
        className="reel-save absolute right-3 z-30 flex flex-col items-center"
        style={{ bottom: saveBottomPx }}
        onMouseEnter={keepInfoOpenIfAlready}
        onMouseLeave={scheduleInfoClose}
      >
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
          aria-pressed={saved}
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
