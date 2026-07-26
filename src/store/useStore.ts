/**
 * Zustand store — the single source of truth for Go!
 *
 * Vision: Go! has no backend yet. This store owns discovery content, the user's
 * saved "roams", friend groups, and the temporary voting session. Any screen can
 * subscribe to slices of this state and stay in sync automatically.
 *
 * Mental model of the user journey stored here:
 *   Feed → heart a place (savedIds)
 *   My Roams → review saved places
 *   Groups → create a crew
 *   Event Setup → pick 2–5 saved places → setVotingPlaces
 *   Voting → castVote / revealWinner
 *
 * Persistence note: state lives in memory only. Refreshing the page resets it.
 * A natural next step is `persist` middleware (localStorage) when you want saves
 * to survive reloads.
 */

import { create } from 'zustand'
import { samplePlaces } from '../data/places'
import type { Group, Place } from '../types'

/** Shape of everything the app can read or mutate through `useStore`. */
interface AppState {
  /** Full catalog of discoverable places (seeded from `data/places.ts`). */
  places: Place[]
  /** IDs of places the user hearted — this is the My Roams library. */
  savedIds: string[]
  /** Friend groups created on the Groups screen. */
  groups: Group[]

  // --- Voting session (ephemeral, reset when a new vote starts) ---
  /** Place IDs chosen in Event Setup and shown on the Voting screen. */
  votingPlaceIds: string[]
  /** Vote tallies keyed by place id. */
  votes: Record<string, number>
  /** The place the current user has selected as their vote (single choice). */
  selectedVoteId: string | null
  /** Winning place id after "Reveal Winner"; null while voting is open. */
  winnerId: string | null

  /** Heart / un-heart a place in My Roams. */
  toggleSave: (id: string) => void
  /** Create a group from a name + member list. */
  addGroup: (name: string, members: string[]) => void
  /** Resolve saved IDs into full Place objects for Roams / Event Setup. */
  getSavedPlaces: () => Place[]
  /** Begin a voting round with the places picked in Event Setup. */
  setVotingPlaces: (ids: string[]) => void
  /** Cast (or switch / undo) the user's single vote. Locked after reveal. */
  castVote: (placeId: string) => void
  /** Pick the place with the highest vote count and lock further voting. */
  revealWinner: () => void
  /** Clear the voting session (handy if you add a "vote again" flow later). */
  resetVoting: () => void
}

/**
 * Global app store. Components should subscribe narrowly, e.g.
 * `useStore((s) => s.savedIds)`, so they only re-render when that slice changes.
 */
export const useStore = create<AppState>((set, get) => ({
  places: samplePlaces,
  savedIds: [],
  groups: [],
  votingPlaceIds: [],
  votes: {},
  selectedVoteId: null,
  winnerId: null,

  /**
   * Toggle a place in/out of My Roams.
   * Idempotent: tapping Save again removes it (same heart UX as Instagram).
   */
  toggleSave: (id) =>
    set((state) => ({
      savedIds: state.savedIds.includes(id)
        ? state.savedIds.filter((savedId) => savedId !== id)
        : [...state.savedIds, id],
    })),

  /**
   * Append a new group. Members arrive as a raw string array (already split
   * from the comma-separated input on the Groups form). Empty names are trimmed out.
   */
  addGroup: (name, members) =>
    set((state) => ({
      groups: [
        ...state.groups,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          members: members.map((m) => m.trim()).filter(Boolean),
        },
      ],
    })),

  /**
   * Convenience selector: places whose ids are in `savedIds`.
   * Prefer calling this after subscribing to `savedIds` so React re-renders
   * when the library changes.
   */
  getSavedPlaces: () => {
    const { places, savedIds } = get()
    return places.filter((place) => savedIds.includes(place.id))
  },

  /**
   * Seed a new voting round. Resets tallies, selection, and winner so each
   * Event Setup → Vote flow starts clean.
   */
  setVotingPlaces: (ids) =>
    set({
      votingPlaceIds: ids,
      votes: Object.fromEntries(ids.map((id) => [id, 0])),
      selectedVoteId: null,
      winnerId: null,
    }),

  /**
   * Single-choice voting:
   * - First tap on a place → +1 and mark it selected
   * - Tap the same place again → undo that vote
   * - Tap a different place → move your vote over
   * No-ops after the winner is revealed.
   */
  castVote: (placeId) =>
    set((state) => {
      if (state.winnerId) return state
      if (!state.votingPlaceIds.includes(placeId)) return state

      const nextVotes = { ...state.votes }

      // Undo if tapping the already-selected card
      if (state.selectedVoteId === placeId) {
        nextVotes[placeId] = Math.max(0, (nextVotes[placeId] ?? 0) - 1)
        return { votes: nextVotes, selectedVoteId: null }
      }

      // Move vote away from the previous selection, if any
      if (state.selectedVoteId) {
        nextVotes[state.selectedVoteId] = Math.max(
          0,
          (nextVotes[state.selectedVoteId] ?? 0) - 1,
        )
      }

      nextVotes[placeId] = (nextVotes[placeId] ?? 0) + 1
      return { votes: nextVotes, selectedVoteId: placeId }
    }),

  /**
   * Declare the place with the most votes the winner.
   * Ties currently favor the earliest place in `votingPlaceIds` (stable & simple).
   */
  revealWinner: () => {
    const { votes, votingPlaceIds } = get()
    if (votingPlaceIds.length === 0) return

    let winnerId = votingPlaceIds[0]
    let maxVotes = votes[winnerId] ?? 0

    for (const id of votingPlaceIds) {
      const count = votes[id] ?? 0
      if (count > maxVotes) {
        maxVotes = count
        winnerId = id
      }
    }

    set({ winnerId })
  },

  /** Wipe voting session state without touching saved places or groups. */
  resetVoting: () =>
    set({
      votingPlaceIds: [],
      votes: {},
      selectedVoteId: null,
      winnerId: null,
    }),
}))
