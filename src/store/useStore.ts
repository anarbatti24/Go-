/**
 * Zustand store — the single source of truth for Go! client state
 *
 * Vision: discovery content loads from Yelp + TMDB based on the user's city /
 * zip. Saved roams are cached as full Place objects so they survive catalog
 * refreshes when the location changes.
 */

import { create } from 'zustand'
import { samplePlaces } from '../data/places'
import type { Group, Place } from '../types'
import { createId } from '../utils/id'

const LOCATION_KEY = 'go-user-location'

function readStoredLocation(): string {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? ''
  } catch {
    return ''
  }
}

interface AppState {
  places: Place[]
  savedIds: string[]
  /** Full place snapshots so My Roams still works after a catalog refresh. */
  savedPlaceCache: Record<string, Place>
  groups: Group[]
  /** City, neighborhood, or ZIP used for discovery. */
  userLocation: string
  placesStatus: 'idle' | 'loading' | 'ready' | 'error'
  placesMessage: string | null

  toggleSave: (id: string) => void
  addGroup: (name: string, members: string[], roomCode: string) => Group
  getSavedPlaces: () => Place[]
  setUserLocation: (location: string) => void
  setPlaces: (places: Place[], message?: string | null) => void
  /** Merge remote place snapshots (e.g. friends' room suggestions) into catalog. */
  mergePlaces: (incoming: Place[]) => void
  setPlacesStatus: (
    status: AppState['placesStatus'],
    message?: string | null,
  ) => void
}

export const useStore = create<AppState>((set, get) => ({
  places: samplePlaces,
  savedIds: [],
  savedPlaceCache: {},
  groups: [],
  userLocation: typeof window !== 'undefined' ? readStoredLocation() : '',
  placesStatus: 'idle',
  placesMessage: null,

  toggleSave: (id) =>
    set((state) => {
      const isSaved = state.savedIds.includes(id)
      if (isSaved) {
        const { [id]: _removed, ...rest } = state.savedPlaceCache
        return {
          savedIds: state.savedIds.filter((savedId) => savedId !== id),
          savedPlaceCache: rest,
        }
      }

      const place =
        state.places.find((p) => p.id === id) ?? state.savedPlaceCache[id]
      return {
        savedIds: [...state.savedIds, id],
        savedPlaceCache: place
          ? { ...state.savedPlaceCache, [id]: place }
          : state.savedPlaceCache,
      }
    }),

  addGroup: (name, members, roomCode) => {
    const group: Group = {
      id: createId(),
      name: name.trim(),
      members: members.map((m) => m.trim()).filter(Boolean),
      roomCode,
    }
    set((state) => ({ groups: [...state.groups, group] }))
    return group
  },

  getSavedPlaces: () => {
    const { places, savedIds, savedPlaceCache } = get()
    return savedIds
      .map(
        (id) =>
          places.find((place) => place.id === id) ?? savedPlaceCache[id],
      )
      .filter((place): place is Place => Boolean(place))
  },

  setUserLocation: (location) => {
    const trimmed = location.trim()
    try {
      if (trimmed) localStorage.setItem(LOCATION_KEY, trimmed)
      else localStorage.removeItem(LOCATION_KEY)
    } catch {
      // ignore quota / private mode
    }
    set({ userLocation: trimmed })
  },

  setPlaces: (places, message = null) =>
    set({
      places,
      placesStatus: 'ready',
      placesMessage: message,
    }),

  mergePlaces: (incoming) =>
    set((state) => {
      if (incoming.length === 0) return state
      const byId = new Map(state.places.map((p) => [p.id, p]))
      let changed = false
      for (const place of incoming) {
        if (!byId.has(place.id)) {
          byId.set(place.id, place)
          changed = true
        }
      }
      if (!changed) return state
      return { places: Array.from(byId.values()) }
    }),

  setPlacesStatus: (status, message = null) =>
    set({ placesStatus: status, placesMessage: message }),
}))
