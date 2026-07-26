/**
 * Go! — core TypeScript models
 *
 * Vision: Go! is a social discovery app for finding places ("roams") and deciding
 * where to hang out with friends. Everything is local for now (no backend/auth),
 * so these types are the contract the whole UI + Zustand store share.
 *
 * When you later add an API, keep these shapes as the client-side models and map
 * server DTOs into them so the screens barely need to change.
 */

/**
 * A discoverable place shown in the Reels-style Feed and saved into My Roams.
 * `price` is a 1–4 money-bag scale (not a dollar amount) — see `utils/price.ts`.
 * `image` currently points at picsum.photos portrait URLs for a phone-first look.
 */
export interface Place {
  id: string
  name: string
  description: string
  image: string
  /** Relative cost vibe: 1 = cheap, 4 = splurge */
  price: 1 | 2 | 3 | 4
  /** Human-readable distance string, e.g. "0.4 mi" */
  distance: string
  /** Street / venue address shown in detail views */
  location: string
  /** Soft taxonomy for the reel overlay (Café, Nightlife, Outdoors, …) */
  category: string
}

/**
 * A friend group that plans an outing together.
 * Creating a group unlocks Event Setup → Voting for that crew.
 * `members` is a simple string list today; later this could become user IDs.
 */
export interface Group {
  id: string
  name: string
  members: string[]
}
