/**
 * Interest + age catalogs for first-run onboarding (Reddit-style prefs).
 *
 * Matching is intentionally fuzzy: Yelp categories, cuisine, genres, and
 * place names get scanned so sample + live catalogs both personalize.
 */

import type { Place } from '../types'

export type AgeRangeId =
  | 'under18'
  | '18-24'
  | '25-34'
  | '35-44'
  | '45-54'
  | '55plus'

export type InterestId =
  | 'food'
  | 'outdoors'
  | 'nightlife'
  | 'movies'
  | 'coffee'
  | 'arts'
  | 'fitness'
  | 'music'
  | 'shopping'
  | 'games'
  | 'sweets'
  | 'chill'
  | 'travel'
  | 'pets'
  | 'wellness'

export interface AgeRangeOption {
  id: AgeRangeId
  label: string
  hint: string
}

export interface InterestOption {
  id: InterestId
  label: string
  /** Keywords matched against category / cuisine / genres / name / description. */
  keywords: string[]
  /** Soft-boost when the user's age range aligns with this vibe. */
  ageBoost?: AgeRangeId[]
}

export interface UserPrefs {
  ageRange: AgeRangeId
  /** Up to MAX_INTERESTS ids, ordered by pick time. */
  interests: InterestId[]
  /** Max travel distance in miles for nearby results (0–500). */
  maxDistanceMiles: number
  completedAt: number
}

export const MIN_TRAVEL_MILES = 0
export const MAX_TRAVEL_MILES = 500
export const DEFAULT_TRAVEL_MILES = 25

/** Yelp hard-caps radius at 40,000 meters (~24.85 mi). */
export function milesToYelpRadiusMeters(miles: number): number | null {
  if (!Number.isFinite(miles) || miles <= 0) return 400
  // Beyond Yelp's cap, omit a tight radius and search by location string.
  if (miles > 25) return null
  return Math.min(40000, Math.max(400, Math.round(miles * 1609.344)))
}

export function clampTravelMiles(miles: number): number {
  if (!Number.isFinite(miles)) return DEFAULT_TRAVEL_MILES
  return Math.min(MAX_TRAVEL_MILES, Math.max(MIN_TRAVEL_MILES, Math.round(miles)))
}

/** Parse labels like "0.4 mi" / "3.2 mi" from Place.distance. */
export function parseMiles(distance: string | undefined): number | null {
  if (!distance) return null
  const match = distance.match(/([\d.]+)\s*mi/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

export function placeWithinDistance(
  place: Place,
  maxMiles: number,
): boolean {
  // Movies / theater labels aren't geographic — always keep them.
  if (place.source === 'tmdb') return true
  if (/in theaters/i.test(place.distance)) return true
  const miles = parseMiles(place.distance)
  if (miles == null) return true
  if (maxMiles <= 0) return miles <= 0.05
  return miles <= maxMiles + 0.05
}

export const AGE_RANGES: AgeRangeOption[] = [
  { id: 'under18', label: 'Under 18', hint: 'School / hangouts' },
  { id: '18-24', label: '18–24', hint: 'Campus & nightlife' },
  { id: '25-34', label: '25–34', hint: 'Date nights & weekends' },
  { id: '35-44', label: '35–44', hint: 'Groups & family' },
  { id: '45-54', label: '45–54', hint: 'Easy evenings out' },
  { id: '55plus', label: '55+', hint: 'Classic favorites' },
]

/** Big chip grid so the app feels like it covers a lot of ground. */
export const INTERESTS: InterestOption[] = [
  {
    id: 'food',
    label: 'Food & Eating',
    keywords: [
      'restaurant',
      'food',
      'eat',
      'dining',
      'mexican',
      'italian',
      'chinese',
      'thai',
      'indian',
      'sushi',
      'ramen',
      'pizza',
      'burger',
      'bbq',
      'seafood',
      'steak',
      'asian',
      'american',
      'brunch',
      'taco',
      'noodle',
      'kitchen',
      'grill',
    ],
    ageBoost: ['18-24', '25-34', '35-44'],
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    keywords: [
      'outdoor',
      'hike',
      'hiking',
      'trail',
      'park',
      'nature',
      'beach',
      'camp',
      'climb',
      'bike',
      'kayak',
      'scenic',
      'overlook',
      'garden',
      'active',
    ],
    ageBoost: ['25-34', '35-44', '45-54', '55plus'],
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    keywords: [
      'nightlife',
      'bar',
      'club',
      'cocktail',
      'speakeasy',
      'lounge',
      'pub',
      'brewery',
      'wine',
      'dance',
      'late-night',
      'night life',
    ],
    ageBoost: ['18-24', '25-34'],
  },
  {
    id: 'movies',
    label: 'Movies',
    keywords: [
      'movie',
      'cinema',
      'theater',
      'film',
      'tmdb',
      'action',
      'comedy',
      'drama',
      'horror',
      'romance',
      'sci-fi',
      'animation',
    ],
    ageBoost: ['under18', '18-24', '25-34'],
  },
  {
    id: 'coffee',
    label: 'Coffee & Cafés',
    keywords: [
      'café',
      'cafe',
      'coffee',
      'espresso',
      'tea',
      'bakery',
      'pastry',
      'latte',
    ],
    ageBoost: ['25-34', '35-44', '45-54', '55plus'],
  },
  {
    id: 'arts',
    label: 'Arts & Culture',
    keywords: [
      'art',
      'museum',
      'gallery',
      'exhibit',
      'culture',
      'theater',
      'theatre',
      'pottery',
      'studio',
      'history',
    ],
    ageBoost: ['35-44', '45-54', '55plus'],
  },
  {
    id: 'fitness',
    label: 'Fitness & Sports',
    keywords: [
      'fitness',
      'gym',
      'sport',
      'yoga',
      'climb',
      'bowling',
      'golf',
      'run',
      'workout',
      'active',
      'recreation',
    ],
    ageBoost: ['18-24', '25-34', '35-44'],
  },
  {
    id: 'music',
    label: 'Live Music',
    keywords: [
      'music',
      'concert',
      'live',
      'jazz',
      'venue',
      'band',
      'karaoke',
      'dj',
      'festival',
    ],
    ageBoost: ['18-24', '25-34'],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    keywords: [
      'shop',
      'shopping',
      'market',
      'boutique',
      'mall',
      'retail',
      'thrift',
      'vintage',
      'store',
    ],
  },
  {
    id: 'games',
    label: 'Games & Arcades',
    keywords: [
      'game',
      'arcade',
      'bowling',
      'billiard',
      'pool hall',
      'escape',
      'board game',
      'laser',
      'mini golf',
      'entertainment',
    ],
    ageBoost: ['under18', '18-24'],
  },
  {
    id: 'sweets',
    label: 'Sweet Treats',
    keywords: [
      'dessert',
      'ice cream',
      'bakery',
      'donut',
      'doughnut',
      'chocolate',
      'candy',
      'pastry',
      'sweet',
      'gelato',
    ],
  },
  {
    id: 'chill',
    label: 'Chill Hangouts',
    keywords: [
      'chill',
      'lounge',
      'park',
      'picnic',
      'bookstore',
      'library',
      'casual',
      'hangout',
      'plaza',
    ],
  },
  {
    id: 'travel',
    label: 'Day Trips',
    keywords: [
      'scenic',
      'viewpoint',
      'overlook',
      'tour',
      'attraction',
      'landmark',
      'waterfront',
      'harbor',
      'coast',
      'day trip',
    ],
  },
  {
    id: 'pets',
    label: 'Pets & Animals',
    keywords: [
      'pet',
      'dog',
      'animal',
      'zoo',
      'aquarium',
      'dog-friendly',
      'dog park',
    ],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    keywords: [
      'spa',
      'wellness',
      'massage',
      'sauna',
      'yoga',
      'meditation',
      'self-care',
      'bath',
    ],
    ageBoost: ['25-34', '35-44', '45-54', '55plus'],
  },
]

export const MAX_INTERESTS = 5

const INTEREST_BY_ID = Object.fromEntries(
  INTERESTS.map((item) => [item.id, item]),
) as Record<InterestId, InterestOption>

function haystack(place: Place): string {
  return [
    place.name,
    place.description,
    place.category,
    place.cuisine ?? '',
    place.source,
    ...(place.genres ?? []),
  ]
    .join(' ')
    .toLowerCase()
}

export function scorePlaceForPrefs(
  place: Place,
  interestIds: InterestId[],
  ageRange?: AgeRangeId | null,
): number {
  if (interestIds.length === 0) return 0
  const text = haystack(place)
  let score = 0

  if (interestIds.includes('movies') && place.source === 'tmdb') {
    score += 3
  }
  if (
    interestIds.some((id) =>
      ['outdoors', 'arts', 'travel', 'chill', 'pets', 'fitness'].includes(id),
    ) &&
    place.source === 'overpass'
  ) {
    score += 4
  }
  if (
    interestIds.some((id) =>
      ['music', 'nightlife', 'arts', 'games'].includes(id),
    ) &&
    place.source === 'ticketmaster'
  ) {
    score += 4
  }

  for (const id of interestIds) {
    const interest = INTEREST_BY_ID[id]
    if (!interest) continue
    let hit = false
    for (const keyword of interest.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        hit = true
        break
      }
    }
    if (hit) {
      score += 2
      if (ageRange && interest.ageBoost?.includes(ageRange)) score += 1
    }
  }

  return score
}

/**
 * Keep the full catalog, but sprinkle strong matches every few cards so the
 * feed still feels broad while staying sticky for this user.
 */
export function personalizeFeed(
  places: Place[],
  prefs: UserPrefs | null,
): { feed: Place[]; forYouIds: Set<string> } {
  const scoped = prefs
    ? places.filter((place) =>
        placeWithinDistance(place, prefs.maxDistanceMiles),
      )
    : places

  if (!prefs || prefs.interests.length === 0 || scoped.length === 0) {
    return { feed: scoped, forYouIds: new Set() }
  }

  const scored = scoped.map((place) => ({
    place,
    score: scorePlaceForPrefs(place, prefs.interests, prefs.ageRange),
  }))

  const matched = scored.filter((row) => row.score > 0).map((row) => row.place)
  const rest = scored.filter((row) => row.score === 0).map((row) => row.place)

  if (matched.length === 0) {
    return { feed: scoped, forYouIds: new Set() }
  }

  const forYouIds = new Set<string>()
  const feed: Place[] = []
  let mi = 0
  let ri = 0
  let i = 0

  // Prefer matches ~2 of every 3 cards; sprinkle the rest so the feed stays broad.
  while (mi < matched.length || ri < rest.length) {
    const wantForYou = i % 3 !== 2
    if (wantForYou && mi < matched.length) {
      const place = matched[mi++]!
      feed.push(place)
      forYouIds.add(place.id)
    } else if (ri < rest.length) {
      feed.push(rest[ri++]!)
    } else if (mi < matched.length) {
      const place = matched[mi++]!
      feed.push(place)
      forYouIds.add(place.id)
    }
    i += 1
  }

  return { feed, forYouIds }
}
