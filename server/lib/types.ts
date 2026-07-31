/**
 * Shared server types for rooms + discovery (Vite plugins + Vercel functions).
 */

export type RoomPhase = 'lobby' | 'voting' | 'tie' | 'picking' | 'results'

/** How the final winner was decided. */
export type WinnerResolution = 'votes' | 'random'

/** Dramatic pause before RNG resolves a second-round tie. */
export const PICKING_DURATION_MS = 5000

/** Full-screen “it’s a tie” beat before the automatic re-vote. */
export const TIE_PAUSE_MS = 5000

export interface EventMember {
  id: string
  name: string
  isHost: boolean
}

export interface EventSuggestion {
  placeId: string
  addedById: string
  addedByName: string
  /** Full place snapshot so every client can render without a shared catalog. */
  place?: Place
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
  /**
   * Voting round: 1 = first vote, 2 = tiebreaker re-vote.
   * After round 2 a remaining tie is broken by RNG.
   */
  voteRound: number
  /**
   * Place IDs still in contention. Null means every suggestion is eligible.
   * Set to the tied options when entering a runoff.
   */
  eligiblePlaceIds: string[] | null
  /** How the winner was chosen; null until results. */
  resolvedBy: WinnerResolution | null
  /** Epoch ms when the system-pick countdown ends; set during `picking`. */
  pickingEndsAt: number | null
  /**
   * Epoch ms when the first-tie drama ends and the re-vote auto-starts.
   * Set during `tie`; null otherwise.
   */
  tieEndsAt: number | null
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
