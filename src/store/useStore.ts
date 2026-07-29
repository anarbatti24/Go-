/**
 * Zustand store — the single source of truth for Go! client state
 *
 * Vision: discovery content loads from Yelp + TMDB based on the user's city /
 * zip. Saved roams are cached as full Place objects so they survive catalog
 * refreshes when the location changes. First-run prefs personalize the Feed.
 */

import { create } from 'zustand'
import { samplePlaces } from '../data/places'
import type {
  AgeRangeId,
  InterestId,
  UserPrefs,
} from '../data/interests'
import { clampTravelMiles, DEFAULT_TRAVEL_MILES } from '../data/interests'
import type { Group, Place } from '../types'
import { createId } from '../utils/id'

const LOCATION_KEY = 'go-user-location'
const PREFS_KEY = 'go-user-prefs'
const GROUPS_KEY = 'go-user-groups'

function readStoredLocation(): string {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? ''
  } catch {
    return ''
  }
}

function readStoredPrefs(): UserPrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserPrefs>
    if (
      typeof parsed.ageRange !== 'string' ||
      !Array.isArray(parsed.interests) ||
      parsed.interests.length === 0
    ) {
      return null
    }
    const maxDistanceMiles =
      typeof parsed.maxDistanceMiles === 'number' &&
      Number.isFinite(parsed.maxDistanceMiles)
        ? Math.min(500, Math.max(0, Math.round(parsed.maxDistanceMiles)))
        : DEFAULT_TRAVEL_MILES
    return {
      ageRange: parsed.ageRange as AgeRangeId,
      interests: parsed.interests.slice(0, 3) as InterestId[],
      maxDistanceMiles,
      completedAt:
        typeof parsed.completedAt === 'number' ? parsed.completedAt : Date.now(),
    }
  } catch {
    return null
  }
}

function readStoredGroups(): Group[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (g): g is Group =>
          Boolean(g) &&
          typeof g === 'object' &&
          typeof (g as Group).id === 'string' &&
          typeof (g as Group).name === 'string' &&
          typeof (g as Group).roomCode === 'string' &&
          Array.isArray((g as Group).members),
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        roomCode: g.roomCode,
        members: g.members.filter((m): m is string => typeof m === 'string'),
      }))
  } catch {
    return []
  }
}

function persistGroups(groups: Group[]) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
  } catch {
    // ignore quota / private mode
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
  /** First-run age + interests; null until onboarding finishes. */
  userPrefs: UserPrefs | null
  placesStatus: 'idle' | 'loading' | 'ready' | 'error'
  placesMessage: string | null

  toggleSave: (id: string) => void
  addGroup: (
    name: string,
    members: string[],
    roomCode: string,
    groupId?: string,
  ) => Group
  getSavedPlaces: () => Place[]
  setUserLocation: (location: string) => void
  setUserPrefs: (prefs: {
    ageRange: AgeRangeId
    interests: InterestId[]
    maxDistanceMiles: number
  }) => void
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
  groups: typeof window !== 'undefined' ? readStoredGroups() : [],
  userLocation: typeof window !== 'undefined' ? readStoredLocation() : '',
  userPrefs: typeof window !== 'undefined' ? readStoredPrefs() : null,
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

  addGroup: (name, members, roomCode, groupId) => {
    const trimmedCode = roomCode.trim()
    const nextMembers = members.map((m) => m.trim()).filter(Boolean)
    const existing = get().groups.find((g) => g.roomCode === trimmedCode)

    if (existing) {
      const updated: Group = {
        ...existing,
        name: name.trim() || existing.name,
        members: nextMembers.length > 0 ? nextMembers : existing.members,
      }
      set((state) => {
        const groups = state.groups.map((g) =>
          g.roomCode === trimmedCode ? updated : g,
        )
        persistGroups(groups)
        return { groups }
      })
      return updated
    }

    const group: Group = {
      id: groupId?.trim() || createId(),
      name: name.trim(),
      members: nextMembers,
      roomCode: trimmedCode,
    }
    set((state) => {
      const groups = [...state.groups, group]
      persistGroups(groups)
      return { groups }
    })
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

  setUserPrefs: ({ ageRange, interests, maxDistanceMiles }) => {
    const prefs: UserPrefs = {
      ageRange,
      interests: interests.slice(0, 3),
      maxDistanceMiles: clampTravelMiles(maxDistanceMiles),
      completedAt: Date.now(),
    }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // ignore quota / private mode
    }
    set({ userPrefs: prefs })
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
