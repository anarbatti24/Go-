/**
 * Feed (`/`) — Reels-style discovery of real nearby places + movies
 *
 * Vision: ask for a city/ZIP, then load ~30 live results from Yelp + TMDB
 * (proxied through Vite). Heart anything good into My Roams for group voting.
 */

import { useCallback, useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { discoverPlaces } from '../api/discover'
import { LocationPrompt } from '../components/LocationPrompt'
import { ReelCard } from '../components/ReelCard'
import { samplePlaces } from '../data/places'
import { useStore } from '../store/useStore'

export function Feed() {
  const places = useStore((s) => s.places)
  const savedIds = useStore((s) => s.savedIds)
  const toggleSave = useStore((s) => s.toggleSave)
  const userLocation = useStore((s) => s.userLocation)
  const placesStatus = useStore((s) => s.placesStatus)
  const placesMessage = useStore((s) => s.placesMessage)
  const setUserLocation = useStore((s) => s.setUserLocation)
  const setPlaces = useStore((s) => s.setPlaces)
  const setPlacesStatus = useStore((s) => s.setPlacesStatus)

  const [editingLocation, setEditingLocation] = useState(!userLocation)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadForLocation = useCallback(
    async (location: string) => {
      setPlacesStatus('loading')
      setLoadError(null)
      try {
        const data = await discoverPlaces(location)
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
    if (!userLocation) {
      setEditingLocation(true)
      return
    }
    void loadForLocation(userLocation)
  }, [userLocation, loadForLocation])

  const handleLocationSubmit = (location: string) => {
    setUserLocation(location)
    setEditingLocation(false)
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
        <p className="text-sm text-white/80">Finding things near {userLocation}…</p>
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
        <span className="truncate">{userLocation}</span>
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
