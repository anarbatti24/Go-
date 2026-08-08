/**
 * Interest → upstream query plans for multi-source discovery.
 * Keep in sync with client InterestId in src/data/interests.ts.
 */

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

export const ALL_INTEREST_IDS: InterestId[] = [
  'food',
  'outdoors',
  'nightlife',
  'movies',
  'coffee',
  'arts',
  'fitness',
  'music',
  'shopping',
  'games',
  'sweets',
  'chill',
  'travel',
  'pets',
  'wellness',
]

/** Yelp Fusion category aliases per interest. */
export const YELP_CATEGORIES: Partial<Record<InterestId, string>> = {
  food: 'restaurants',
  coffee: 'coffee,cafes',
  sweets: 'desserts,icecream,gelato,donuts,bakeries',
  nightlife: 'nightlife,bars,cocktailbars,danceclubs',
  outdoors: 'beaches,parks,hiking,lakes,rafting,camping',
  arts: 'museums,galleries,artmuseums,theater',
  fitness: 'gyms,yoga,recreation,rock_climbing,bowling',
  music: 'musicvenues,jazzandblues',
  shopping: 'shopping,farmersmarket,fleamarkets',
  games: 'arcades,bowling,escapegames,mini_golf,poolhalls',
  chill: 'parks,bookstores,libraries',
  travel: 'tours,landmarks,localflavor',
  pets: 'pets,dog_parks,zoos,aquariums',
  wellness: 'spas,massage,saunas',
}

export const YELP_TERMS: Partial<Record<InterestId, string>> = {
  food: 'restaurants',
  coffee: 'coffee',
  sweets: 'dessert',
  nightlife: 'nightlife',
  outdoors: 'outdoors beach park',
  arts: 'museum art gallery',
  fitness: 'fitness gym',
  music: 'live music',
  shopping: 'shopping',
  games: 'arcade games',
  chill: 'park hangout',
  travel: 'attraction viewpoint',
  pets: 'dog park zoo',
  wellness: 'spa wellness',
}

/**
 * Overpass (OSM) tag filters — global POIs: beaches, museums, parks, etc.
 * Each entry is a (key, value) pair matched as node/way/relation.
 */
export type OsmTag = { key: string; value: string; label: string }

export const OVERPASS_TAGS: Partial<Record<InterestId, OsmTag[]>> = {
  outdoors: [
    { key: 'leisure', value: 'beach', label: 'Beach' },
    { key: 'natural', value: 'beach', label: 'Beach' },
    { key: 'leisure', value: 'park', label: 'Park' },
    { key: 'leisure', value: 'nature_reserve', label: 'Nature reserve' },
    { key: 'tourism', value: 'viewpoint', label: 'Viewpoint' },
    { key: 'leisure', value: 'garden', label: 'Garden' },
  ],
  arts: [
    { key: 'tourism', value: 'museum', label: 'Museum' },
    { key: 'tourism', value: 'gallery', label: 'Gallery' },
    { key: 'amenity', value: 'arts_centre', label: 'Arts centre' },
    { key: 'amenity', value: 'theatre', label: 'Theatre' },
  ],
  travel: [
    { key: 'tourism', value: 'attraction', label: 'Attraction' },
    { key: 'tourism', value: 'viewpoint', label: 'Viewpoint' },
    { key: 'tourism', value: 'zoo', label: 'Zoo' },
    { key: 'historic', value: 'monument', label: 'Monument' },
    { key: 'tourism', value: 'aquarium', label: 'Aquarium' },
  ],
  chill: [
    { key: 'leisure', value: 'park', label: 'Park' },
    { key: 'leisure', value: 'garden', label: 'Garden' },
    { key: 'amenity', value: 'library', label: 'Library' },
  ],
  pets: [
    { key: 'leisure', value: 'dog_park', label: 'Dog park' },
    { key: 'tourism', value: 'zoo', label: 'Zoo' },
    { key: 'tourism', value: 'aquarium', label: 'Aquarium' },
  ],
  fitness: [
    { key: 'leisure', value: 'fitness_centre', label: 'Fitness' },
    { key: 'leisure', value: 'sports_centre', label: 'Sports centre' },
    { key: 'leisure', value: 'stadium', label: 'Stadium' },
    { key: 'leisure', value: 'pitch', label: 'Sports field' },
  ],
  shopping: [
    { key: 'shop', value: 'mall', label: 'Mall' },
    { key: 'amenity', value: 'marketplace', label: 'Market' },
  ],
}

/** Ticketmaster Discovery classificationName values. */
export const TICKETMASTER_CLASSIFICATIONS: Partial<Record<InterestId, string>> =
  {
    music: 'Music',
    nightlife: 'Music',
    arts: 'Arts & Theatre',
    games: 'Sports',
  }

export function parseInterestIds(raw: string | null | undefined): InterestId[] {
  if (!raw?.trim()) return []
  const allowed = new Set<string>(ALL_INTEREST_IDS)
  const seen = new Set<InterestId>()
  const out: InterestId[] = []
  for (const part of raw.split(',')) {
    const id = part.trim() as InterestId
    if (!allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 5) break
  }
  return out
}

/** Default mix when the client sends no interests yet. */
export const DEFAULT_DISCOVER_INTERESTS: InterestId[] = [
  'outdoors',
  'food',
  'arts',
  'music',
  'nightlife',
]
