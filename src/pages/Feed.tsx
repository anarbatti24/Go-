/**
 * Feed (`/`) — Reels-style discovery of real nearby places + movies
 *
 * Vision: first-run onboarding captures age, interests, travel radius, and
 * location, then loads live results from Yelp + TMDB. The catalog stays broad —
 * we sprinkle preference matches every few swipes so the feed feels personal.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { discoverPlaces } from '../api/discover'
import { LocationPrompt } from '../components/LocationPrompt'
import { Onboarding } from '../components/Onboarding'
import { ReelCard } from '../components/ReelCard'
import { DEFAULT_TRAVEL_MILES, personalizeFeed } from '../data/interests'
import type { AgeRangeId, InterestId } from '../data/interests'
import { samplePlaces } from '../data/places'
import { useStore } from '../store/useStore'

export function Feed() {
  const places = useStore((s) => s.places)
  const savedIds = useStore((s) => s.savedIds)
  const toggleSave = useStore((s) => s.toggleSave)
  const userLocation = useStore((s) => s.userLocation)
  const userPrefs = useStore((s) => s.userPrefs)
  const placesStatus = useStore((s) => s.placesStatus)
  const placesMessage = useStore((s) => s.placesMessage)
  const setUserLocation = useStore((s) => s.setUserLocation)
  const setUserPrefs = useStore((s) => s.setUserPrefs)
  const setPlaces = useStore((s) => s.setPlaces)
  const setPlacesStatus = useStore((s) => s.setPlacesStatus)

  const [editingLocation, setEditingLocation] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const needsOnboarding = !userPrefs
  const readyForFeed = Boolean(userPrefs && userLocation)
  const radiusMiles = userPrefs?.maxDistanceMiles ?? DEFAULT_TRAVEL_MILES

  const loadForLocation = useCallback(
    async (location: string, miles: number) => {
      setPlacesStatus('loading')
      setLoadError(null)
      try {
        const data = await discoverPlaces(location, miles)
        if (data.sources.fallback && data.places.length === 0) {
          setPlaces(samplePlaces, data.message ?? null)
        } else {
          setPlaces(data.places, data.message ?? null)
        }
        if (data.errors?.length) {
          setLoadError(data.errors.join(' · '))
        }
      } catch (err) {
        setPlacesStatus(
          'error',
          err instanceof Error ? err.message : 'Could not load places',
        )
        setLoadError(err instanceof Error ? err.message : 'Could not load places')
      }
    },
    [setPlaces, setPlacesStatus],
  )

  useEffect(() => {
    if (!readyForFeed || editingLocation) return
    void loadForLocation(userLocation, radiusMiles)
  }, [
    readyForFeed,
    userLocation,
    radiusMiles,
    editingLocation,
    loadForLocation,
  ])

  const { feed, forYouIds } = useMemo(
    () => personalizeFeed(places, userPrefs),
    [places, userPrefs],
  )

  const handleOnboardingComplete = (result: {
    ageRange: AgeRangeId
    interests: InterestId[]
    maxDistanceMiles: number
    location: string
  }) => {
    setUserPrefs({
      ageRange: result.ageRange,
      interests: result.interests,
      maxDistanceMiles: result.maxDistanceMiles,
    })
    setUserLocation(result.location)
    setEditingLocation(false)
    setLoadError(null)
  }

  const handleLocationSubmit = (location: string) => {
    setUserLocation(location)
    setEditingLocation(false)
  }

  if (needsOnboarding) {
    return (
      <Onboarding
        initialLocation={userLocation}
        skipLocation={Boolean(userLocation)}
        busy={placesStatus === 'loading'}
        error={loadError}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  if (editingLocation || !userLocation) {
    return (
      <LocationPrompt
        initialValue={userLocation}
        busy={placesStatus === 'loading'}
        error={loadError}
        onSubmit={handleLocationSubmit}
      />
    )
  }

  if (placesStatus === 'loading' && places.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-primary" />
        <p className="text-sm text-white/80">
          Finding things within {radiusMiles} mi of {userLocation}…
        </p>
      </div>
    )
  }

  if (placesStatus === 'error' && places.length === 0) {
    return (
      <LocationPrompt
        initialValue={userLocation}
        error={loadError || placesMessage}
        onSubmit={handleLocationSubmit}
      />
    )
  }

  return (
    <div className="relative h-full bg-black">
      <button
        type="button"
        onClick={() => setEditingLocation(true)}
        className="absolute left-3 top-3 z-40 inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/20"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {userLocation} · {radiusMiles} mi
        </span>
      </button>

      {placesMessage ? (
        <div className="absolute inset-x-3 top-12 z-40 rounded-xl bg-amber-500/90 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {placesMessage}
        </div>
      ) : null}

      <div
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {feed.map((place) => (
          <section
            key={place.id}
            className="h-full w-full shrink-0 snap-start snap-always"
            aria-label={place.name}
          >
            <ReelCard
              place={place}
              saved={savedIds.includes(place.id)}
              forYou={forYouIds.has(place.id)}
              onToggleSave={() => toggleSave(place.id)}
            />
          </section>
        ))}
      </div>
    </div>
  )
}
