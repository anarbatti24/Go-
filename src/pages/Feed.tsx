/**
 * Feed (`/`) — Reels-style discovery of real nearby places + movies
 *
 * Vision: first-run onboarding captures age, interests, travel radius, and
 * location, then loads live results from Yelp + TMDB. When the local catalog
 * runs dry, an end reel offers a wider radius — prefetched so expand feels
 * seamless.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { discoverPlaces } from '../api/discover'
import { ExpandRadiusReel } from '../components/ExpandRadiusReel'
import { LocationPrompt } from '../components/LocationPrompt'
import { Onboarding } from '../components/Onboarding'
import { ReelCard } from '../components/ReelCard'
import {
  DEFAULT_TRAVEL_KM,
  MAX_TRAVEL_KM,
  nextExpandKm,
  personalizeFeed,
} from '../data/interests'
import type { AgeRangeId, InterestId } from '../data/interests'
import { samplePlaces } from '../data/places'
import { useStore } from '../store/useStore'
import type { Place } from '../types'

interface PrefetchBundle {
  radiusKm: number
  places: Place[]
  message: string | null
  errors: string[]
}

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
  const [prefetch, setPrefetch] = useState<PrefetchBundle | null>(null)
  const [prefetching, setPrefetching] = useState(false)

  /** Skip the normal discover effect after a seamless radius expand. */
  const skipNextLoadRef = useRef(false)
  const prefetchGenRef = useRef(0)

  const needsOnboarding = !userPrefs
  const readyForFeed = Boolean(userPrefs && userLocation)
  const radiusKm = userPrefs?.maxDistanceKm ?? DEFAULT_TRAVEL_KM
  const nextKm = nextExpandKm(radiusKm)
  const expandByKm = Math.max(0, nextKm - radiusKm)
  const atMaxRadius = radiusKm >= MAX_TRAVEL_KM

  const loadForLocation = useCallback(
    async (location: string, km: number, interests?: InterestId[]) => {
      setPlaces([])
      setPlacesStatus('loading')
      setLoadError(null)
      setPrefetch(null)
      setPrefetching(false)
      prefetchGenRef.current += 1
      try {
        const data = await discoverPlaces(location, km, interests)
        if (data.sources.fallback && data.places.length === 0) {
          setPlaces(samplePlaces, data.message ?? null)
        } else {
          setPlaces(data.places, data.message ?? null)
        }
        if (data.errors?.length) {
          setLoadError(data.errors.join(' · '))
        }
      } catch (err) {
        setPlaces([])
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
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false
      return
    }
    void loadForLocation(userLocation, radiusKm, userPrefs?.interests)
  }, [
    readyForFeed,
    userLocation,
    radiusKm,
    userPrefs?.interests,
    editingLocation,
    loadForLocation,
  ])

  // Prefetch the next travel ring so expand can append without a loading flash.
  useEffect(() => {
    if (placesStatus !== 'ready' || !readyForFeed || editingLocation) return
    if (atMaxRadius || expandByKm <= 0) {
      setPrefetch(null)
      setPrefetching(false)
      return
    }

    const gen = ++prefetchGenRef.current
    const targetKm = nextKm
    let cancelled = false
    setPrefetching(true)
    setPrefetch(null)

    void (async () => {
      try {
        const data = await discoverPlaces(
          userLocation,
          targetKm,
          userPrefs?.interests,
        )
        if (cancelled || gen !== prefetchGenRef.current) return
        setPrefetch({
          radiusKm: targetKm,
          places:
            data.sources.fallback && data.places.length === 0
              ? []
              : data.places,
          message: data.message ?? null,
          errors: data.errors ?? [],
        })
      } catch {
        if (cancelled || gen !== prefetchGenRef.current) return
        setPrefetch(null)
      } finally {
        if (!cancelled && gen === prefetchGenRef.current) {
          setPrefetching(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    placesStatus,
    readyForFeed,
    editingLocation,
    atMaxRadius,
    expandByKm,
    nextKm,
    userLocation,
    userPrefs?.interests,
    places.length,
    places[0]?.id,
    places[places.length - 1]?.id,
  ])

  const { feed: personalizedFeed, forYouIds: personalizedForYou } = useMemo(
    () => personalizeFeed(places, userPrefs),
    [places, userPrefs],
  )

  /** Preserve reel order across seamless expands so new cards append after the end reel. */
  const lockedFeedRef = useRef<Place[] | null>(null)
  const lockedForYouRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (placesStatus === 'loading') {
      lockedFeedRef.current = null
      lockedForYouRef.current = null
    }
  }, [placesStatus])

  const { feed, forYouIds } = useMemo(() => {
    const locked = lockedFeedRef.current
    if (locked && locked.length > 0 && places.length >= locked.length) {
      const lockedIds = new Set(locked.map((p) => p.id))
      const stillPresent = locked.every((p) => places.some((x) => x.id === p.id))
      if (stillPresent) {
        const extras = places.filter((p) => !lockedIds.has(p.id))
        if (extras.length > 0) {
          const { feed: extraFeed, forYouIds: extraForYou } = personalizeFeed(
            extras,
            userPrefs,
          )
          const merged = [...locked, ...extraFeed]
          const fy = new Set(lockedForYouRef.current ?? [])
          for (const id of extraForYou) fy.add(id)
          lockedFeedRef.current = merged
          lockedForYouRef.current = fy
          return { feed: merged, forYouIds: fy }
        }
        return {
          feed: locked,
          forYouIds: lockedForYouRef.current ?? personalizedForYou,
        }
      }
    }

    lockedFeedRef.current = personalizedFeed
    lockedForYouRef.current = personalizedForYou
    return { feed: personalizedFeed, forYouIds: personalizedForYou }
  }, [places, userPrefs, personalizedFeed, personalizedForYou])

  const extraCount = useMemo(() => {
    if (!prefetch || prefetch.radiusKm !== nextKm) return null
    const seen = new Set(places.map((p) => p.id))
    return prefetch.places.filter((p) => !seen.has(p.id)).length
  }, [prefetch, nextKm, places])

  const handleOnboardingComplete = (result: {
    ageRange: AgeRangeId
    interests: InterestId[]
    maxDistanceKm: number
    location: string
  }) => {
    setPlaces([])
    setPlacesStatus('loading')
    setLoadError(null)
    setUserPrefs({
      ageRange: result.ageRange,
      interests: result.interests,
      maxDistanceKm: result.maxDistanceKm,
    })
    setUserLocation(result.location)
    setEditingLocation(false)
  }

  const handleLocationSubmit = (location: string) => {
    setPlaces([])
    setPlacesStatus('loading')
    setLoadError(null)
    setUserLocation(location)
    setEditingLocation(false)
  }

  const handleExpandRadius = () => {
    if (!userPrefs || atMaxRadius || expandByKm <= 0) return

    const targetKm = nextKm
    const seen = new Set(places.map((p) => p.id))
    const fresh =
      prefetch?.radiusKm === targetKm
        ? prefetch.places.filter((p) => !seen.has(p.id))
        : []

    // Always skip the radius-change effect — we either apply prefetch or load here.
    skipNextLoadRef.current = true
    setUserPrefs({
      ageRange: userPrefs.ageRange,
      interests: userPrefs.interests,
      maxDistanceKm: targetKm,
    })

    if (fresh.length > 0) {
      setPlaces([...places, ...fresh], prefetch?.message ?? null)
      if (prefetch?.errors?.length) {
        setLoadError(prefetch.errors.join(' · '))
      }
      setPrefetch(null)
      setPrefetching(false)
      return
    }

    // Prefetch missed or empty — discover at the new radius (shows loading screen).
    void loadForLocation(userLocation, targetKm, userPrefs.interests)
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

  if (
    placesStatus === 'loading' ||
    (placesStatus === 'idle' && places.length === 0)
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-primary" />
        <div className="space-y-1.5">
          <p className="text-base font-semibold">Finding things nearby</p>
          <p className="text-sm text-white/70">
            Searching within {radiusKm} km of {userLocation}
          </p>
          <p className="pt-1 text-xs text-white/45">
            This can take a few seconds — hang tight.
          </p>
        </div>
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

  const showEndReel = placesStatus === 'ready' && feed.length > 0

  return (
    <div className="relative h-full bg-black">
      <button
        type="button"
        onClick={() => setEditingLocation(true)}
        className="absolute left-3 top-3 z-40 inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/20"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {userLocation} · {radiusKm} km
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

        {showEndReel ? (
          <section
            className="h-full w-full shrink-0 snap-start snap-always"
            aria-label="Expand travel radius"
          >
            <ExpandRadiusReel
              currentKm={radiusKm}
              expandByKm={expandByKm}
              nextKm={nextKm}
              extraCount={atMaxRadius ? null : extraCount}
              prefetching={prefetching}
              atMax={atMaxRadius}
              onExpand={handleExpandRadius}
            />
          </section>
        ) : null}

        {placesStatus === 'ready' && feed.length === 0 ? (
          <section className="flex h-full w-full shrink-0 snap-start flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <p className="text-lg font-semibold">Nothing in this bubble yet</p>
            <p className="max-w-sm text-sm text-white/70">
              Try a wider travel radius or a different location.
            </p>
            {!atMaxRadius ? (
              <button
                type="button"
                onClick={handleExpandRadius}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white"
              >
                Expand to {nextKm} km
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
