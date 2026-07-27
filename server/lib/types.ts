/**
 * Shared server types for rooms + discovery (Vite plugins + Vercel functions).
 */

export type RoomPhase = 'lobby' | 'voting' | 'results'

export interface EventMember {
  id: string
  name: string
  isHost: boolean
}

export interface EventSuggestion {
  placeId: string
  addedById: string
  addedByName: string
}

export interface EventRoom {
  code: string
  groupId: string
  groupName: string
  hostId: string
  members: EventMember[]
  suggestions: EventSuggestion[]
  votes: Record<string, string>
  winnerId: string | null
  phase: RoomPhase
  voteDurationSeconds: number
  votingEndsAt: number | null
  createdAt: number
  /** Incremented on every write — used for compare-and-swap. */
  version?: number
}

export type PlaceSource = 'yelp' | 'tmdb' | 'sample'

export interface Place {
  id: string
  name: string
  description: string
  image: string
  price: 1 | 2 | 3 | 4 | null
  distance: string
  location: string
  category: string
  source: PlaceSource
  rating?: number
  genres?: string[]
  runtimeMinutes?: number
  cuisine?: string
}

export interface ApiResult {
  status: number
  body: unknown
}
