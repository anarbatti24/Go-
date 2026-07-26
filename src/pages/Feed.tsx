/**
 * Feed (`/`) — Reels-style place discovery
 *
 * Vision: this is the heartbeat of Go!. Users swipe vertically through immersive,
 * phone-sized place cards (one per screen), heart the ones they like, and build
 * a personal library for later group voting.
 *
 * Implementation notes:
 * - CSS scroll-snap gives the Instagram Reels "one item per flick" feel.
 * - Height is 100% of the phone shell main area (see Layout).
 * - Saving writes to Zustand `savedIds`, which My Roams + Event Setup read.
 */

import { ReelCard } from '../components/ReelCard'
import { useStore } from '../store/useStore'

/** Vertical snap feed of every place in the catalog. */
export function Feed() {
  const places = useStore((s) => s.places)
  const savedIds = useStore((s) => s.savedIds)
  const toggleSave = useStore((s) => s.toggleSave)

  return (
    <div className="h-full bg-black">
      {/* Hidden scrollbar, mandatory snap — each child section is one reel */}
      <div
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {places.map((place) => (
          <section
            key={place.id}
            className="h-full w-full shrink-0 snap-start snap-always"
            aria-label={place.name}
          >
            <ReelCard
              place={place}
              saved={savedIds.includes(place.id)}
              onToggleSave={() => toggleSave(place.id)}
            />
          </section>
        ))}
      </div>
    </div>
  )
}
