/**
 * Go! — core TypeScript models
 *
 * Vision: Go! is a social discovery app for finding places ("roams") and deciding
 * where to hang out with friends. Discovery content comes from Yelp (nearby food /
 * activities) + TMDB (movies), with a sample fallback when API keys aren't set.
 */

/** Where a catalog item came from. */
export type PlaceSource = 'yelp' | 'tmdb' | 'sample'

/**
 * A discoverable place / activity / movie shown in the Reels-style Feed.
 * `price` is a 1–4 money-bag scale for venues; movies often leave it null and
 * lean on `rating` + `runtimeMinutes` instead.
 */
export interface Place {
  id: string
  name: string
  description: string
  image: string
  /** Relative cost vibe: 1 = cheap, 4 = splurge. Null when unknown / N/A. */
  price: 1 | 2 | 3 | 4 | null
  /** Human-readable distance (Yelp) or label like "In theaters" (TMDB). */
  distance: string
  /** Address, city, or theater-friendly label. */
  location: string
  /** Cuisine / venue type (Yelp) or primary genre (TMDB). */
  category: string
  source: PlaceSource
  /** Yelp ~1–5 or TMDB ~0–10 */
  rating?: number
  /** Extra genres (movies) or secondary Yelp categories */
  genres?: string[]
  /** Movie runtime in minutes */
  runtimeMinutes?: number
  /** Primary food type from Yelp, e.g. "Mexican" */
  cuisine?: string
}

/**
 * A friend group that plans an outing together.
 * Creating a group immediately opens a live room with a 4-digit `roomCode`
 * friends can join. `members` is a simple string list today.
 */
export interface Group {
  id: string
  name: string
  members: string[]
  /** Live room code from the rooms API — share this to invite friends. */
  roomCode: string
}

/** Someone who has joined a live event room. */
export interface EventMember {
  id: string
  name: string
  isHost: boolean
}

/** A place suggested into the shared event pool. */
export interface EventSuggestion {
  placeId: string
  addedById: string
  addedByName: string
  /**
   * Full place snapshot so every client can render it — friends don't share
   * the same local Feed/My Roams catalog.
   */
  place?: Place
}

/** Kahoot-style room phases: wait → timed vote → (tie) → (picking) → results. */
export type RoomPhase = 'lobby' | 'voting' | 'tie' | 'picking' | 'results'

/** How the final winner was decided. */
export type WinnerResolution = 'votes' | 'random'

/**
 * Shared event room — friends join via 4-digit code or `/join/:code` link,
 * add roams in the lobby, then the host starts a timed voting round.
 * Ties trigger one re-vote among tied options; a second tie uses RNG.
 */
export interface EventRoom {
  code: string
  groupId: string
  groupName: string
  hostId: string
  members: EventMember[]
  suggestions: EventSuggestion[]
  /** memberId → placeId */
  votes: Record<string, string>
  winnerId: string | null
  phase: RoomPhase
  /** How long voting lasts once the host starts (seconds). */
  voteDurationSeconds: number
  /** Epoch ms when voting ends; null while still in lobby / tie pause. */
  votingEndsAt: number | null
  /** 1 = first vote, 2 = tiebreaker re-vote. */
  voteRound: number
  /** Places still in contention; null = all suggestions. */
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
  /** Server-side write counter for concurrent updates. */
  version?: number
}
