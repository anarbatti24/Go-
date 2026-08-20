/**
 * Multi-source discovery — Yelp + TMDB + Overpass (OSM) + Ticketmaster.
 *
 * Interests drive which upstreams we hit and how results are interleaved so
 * the Feed matches onboarding (not just restaurants).
 */

import {
  DEFAULT_DISCOVER_INTERESTS,
  OVERPASS_TAGS,
  TICKETMASTER_CLASSIFICATIONS,
  YELP_CATEGORIES,
  YELP_TERMS,
  parseInterestIds,
  type InterestId,
  type OsmTag,
} from './interestSources.js'
import type { ApiResult, Place } from './types.js'

/** Per-source caps — no global TOTAL_LIMIT; merge keeps every unique result. */
const YELP_PER_INTEREST = 40
const OVERPASS_LIMIT = 80
const TMDB_LIMIT = 20
const TICKETMASTER_LIMIT = 50

interface YelpBusiness {
  id: string
  name: string
  image_url?: string
  review_count?: number
  rating?: number
  price?: string
  distance?: number
  categories?: { alias: string; title: string }[]
  location?: {
    address1?: string
    city?: string
    state?: string
    display_address?: string[]
  }
}

interface TmdbMovieListItem {
  id: number
  title: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  genre_ids?: number[]
}

interface TmdbMovieDetails extends TmdbMovieListItem {
  runtime?: number
  genres?: { id: number; name: string }[]
}

interface GeoPoint {
  lat: number
  lng: number
  label: string
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface TicketmasterEvent {
  id: string
  name: string
  url?: string
  images?: { url: string; width?: number; height?: number }[]
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string }
  }
  classifications?: {
    segment?: { name?: string }
    genre?: { name?: string }
  }[]
  _embedded?: {
    venues?: {
      name?: string
      city?: { name?: string }
      state?: { name?: string; stateCode?: string }
      country?: { name?: string; countryCode?: string }
      address?: { line1?: string }
      location?: { latitude?: string; longitude?: string }
      distance?: number
    }[]
  }
}

const TMDB_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

function metersToKm(meters: number | undefined): string {
  if (meters == null || Number.isNaN(meters)) return 'Nearby'
  const km = meters / 1000
  if (km < 0.1) return '<0.1 km'
  return `${km.toFixed(1)} km`
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function yelpPrice(price: string | undefined): 1 | 2 | 3 | 4 | null {
  if (!price) return null
  return Math.min(4, Math.max(1, price.length)) as 1 | 2 | 3 | 4
}

function mapYelp(biz: YelpBusiness): Place {
  const categories = biz.categories ?? []
  const cuisine = categories[0]?.title
  const genreTitles = categories.map((c) => c.title)
  const address =
    biz.location?.display_address?.join(', ') ||
    [biz.location?.address1, biz.location?.city, biz.location?.state]
      .filter(Boolean)
      .join(', ') ||
    'Nearby'

  const bits: string[] = []
  if (cuisine) bits.push(cuisine)
  if (biz.rating != null) bits.push(`${biz.rating.toFixed(1)}★ on Yelp`)
  if (biz.review_count) bits.push(`${biz.review_count} reviews`)

  return {
    id: `yelp-${biz.id}`,
    name: biz.name,
    description:
      bits.length > 0
        ? bits.join(' · ')
        : 'A local spot worth checking out with friends.',
    image:
      biz.image_url ||
      `https://picsum.photos/seed/${encodeURIComponent(biz.id)}/720/1280`,
    price: yelpPrice(biz.price),
    distance: metersToKm(biz.distance),
    location: address,
    category: cuisine || 'Food & Drink',
    source: 'yelp',
    rating: biz.rating,
    genres: genreTitles,
    cuisine,
  }
}

function mapTmdb(movie: TmdbMovieDetails): Place {
  const genres =
    movie.genres?.map((g) => g.name) ||
    (movie.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean)
  const primary = genres[0] || 'Movie'
  const poster =
    movie.poster_path || movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path || movie.backdrop_path}`
      : `https://picsum.photos/seed/tmdb-${movie.id}/720/1280`

  return {
    id: `tmdb-${movie.id}`,
    name: movie.title,
    description:
      movie.overview?.trim() ||
      'Now playing — grab seats and make a night of it.',
    image: poster,
    price: 2,
    distance: 'In theaters',
    location: 'In theaters',
    category: primary,
    source: 'tmdb',
    rating:
      movie.vote_average != null
        ? Math.round(movie.vote_average * 10) / 10
        : undefined,
    genres,
    runtimeMinutes: movie.runtime || undefined,
  }
}

function overpassLabel(tags: Record<string, string>, fallback: string): string {
  return (
    tags.name ||
    tags['name:en'] ||
    tags.brand ||
    tags.operator ||
    fallback ||
    'Local spot'
  )
}

function mapOverpass(
  el: OverpassElement,
  origin: GeoPoint,
  tagHint: string,
): Place | null {
  const tags = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  const name = overpassLabel(tags, tagHint)
  // Skip unnamed generic footways — too noisy.
  if (!tags.name && !tags['name:en'] && tags.highway === 'footway') return null

  const category =
    tagHint ||
    tags.tourism ||
    tags.leisure ||
    tags.amenity ||
    tags.natural ||
    tags.historic ||
    tags.shop ||
    'Attraction'

  const bits = [category]
  if (tags.sport) bits.push(tags.sport)
  if (tags.cuisine) bits.push(tags.cuisine)

  const city =
    tags['addr:city'] ||
    tags['addr:suburb'] ||
    tags['addr:town'] ||
    tags['addr:place'] ||
    ''
  const streetLine = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ')
  const address = [streetLine, city].filter(Boolean).join(', ')

  const meters = haversineMeters(origin.lat, origin.lng, lat, lng)

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    description: bits.filter(Boolean).join(' · ') || 'A nearby place from the map.',
    image: `https://picsum.photos/seed/${encodeURIComponent(`osm-${el.type}-${el.id}`)}/720/1280`,
    price: null,
    distance: metersToKm(meters),
    // Never fall back to the user's search address — that leaks onto every card.
    location: address || city || 'Nearby',
    category: String(category).replace(/_/g, ' '),
    source: 'overpass',
    genres: [String(category).replace(/_/g, ' '), 'outdoors', 'attraction'],
  }
}

function mapTicketmaster(event: TicketmasterEvent, origin: GeoPoint): Place | null {
  const venue = event._embedded?.venues?.[0]
  const vLat = venue?.location?.latitude
    ? Number(venue.location.latitude)
    : NaN
  const vLng = venue?.location?.longitude
    ? Number(venue.location.longitude)
    : NaN

  const segment = event.classifications?.[0]?.segment?.name || 'Event'
  const genre = event.classifications?.[0]?.genre?.name
  const when = event.dates?.start?.localDate
    ? event.dates.start.localTime
      ? `${event.dates.start.localDate} · ${event.dates.start.localTime}`
      : event.dates.start.localDate
    : 'Upcoming'

  const images = [...(event.images ?? [])].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  )
  const image =
    images[0]?.url ||
    `https://picsum.photos/seed/${encodeURIComponent(event.id)}/720/1280`

  const address = [
    venue?.name,
    venue?.address?.line1,
    venue?.city?.name,
    venue?.state?.stateCode || venue?.state?.name,
  ]
    .filter(Boolean)
    .join(', ')

  const shortVenue =
    [venue?.name, venue?.city?.name].filter(Boolean).join(', ') || 'Nearby venue'

  let distance = 'Nearby'
  if (Number.isFinite(vLat) && Number.isFinite(vLng)) {
    distance = metersToKm(haversineMeters(origin.lat, origin.lng, vLat, vLng))
  } else if (typeof venue?.distance === 'number') {
    distance = metersToKm(venue.distance * 1000)
  }

  return {
    id: `tm-${event.id}`,
    name: event.name,
    description: [segment, genre, when].filter(Boolean).join(' · '),
    image,
    price: null,
    distance,
    location: address || shortVenue,
    category: genre || segment,
    source: 'ticketmaster',
    genres: [segment, genre, 'live', 'event', 'concert', 'music'].filter(
      (g): g is string => Boolean(g),
    ),
  }
}

async function geocodeLocation(query: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    q: query,
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GoApp/1.0 (discovery; contact: local-dev)',
      },
    },
  )
  if (!res.ok) return null
  const data = (await res.json()) as Array<{
    lat?: string
    lon?: string
    display_name?: string
  }>
  const hit = data[0]
  if (!hit?.lat || !hit?.lon) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, label: hit.display_name || query }
}

async function fetchYelpForInterest(
  apiKey: string,
  location: string,
  interest: InterestId,
  limit: number,
  radiusMeters: number | null,
): Promise<Place[]> {
  if (interest === 'movies') return []
  const categories = YELP_CATEGORIES[interest]
  const term = YELP_TERMS[interest] || interest
  if (!categories && !term) return []

  const params = new URLSearchParams({
    location,
    term,
    limit: String(Math.min(50, limit)),
    sort_by: 'best_match',
  })
  if (categories) params.set('categories', categories)
  if (radiusMeters != null) params.set('radius', String(radiusMeters))

  const res = await fetch(
    `https://api.yelp.com/v3/businesses/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Yelp ${res.status}: ${text.slice(0, 180)}`)
  }
  const data = (await res.json()) as { businesses?: YelpBusiness[] }
  return (data.businesses ?? []).map(mapYelp)
}

async function fetchTmdb(
  apiKey: string,
  _areaLabel: string,
  limit: number,
): Promise<Place[]> {
  const listUrl = new URL('https://api.themoviedb.org/3/movie/now_playing')
  listUrl.searchParams.set('language', 'en-US')
  listUrl.searchParams.set('page', '1')
  listUrl.searchParams.set('api_key', apiKey)

  const listRes = await fetch(listUrl)
  if (!listRes.ok) {
    const text = await listRes.text()
    throw new Error(`TMDB ${listRes.status}: ${text.slice(0, 180)}`)
  }

  const listData = (await listRes.json()) as { results?: TmdbMovieListItem[] }
  const movies = (listData.results ?? []).slice(0, limit)

  const detailed = await Promise.all(
    movies.map(async (movie) => {
      try {
        const detailUrl = new URL(
          `https://api.themoviedb.org/3/movie/${movie.id}`,
        )
        detailUrl.searchParams.set('language', 'en-US')
        detailUrl.searchParams.set('api_key', apiKey)
        const detailRes = await fetch(detailUrl)
        if (!detailRes.ok) return movie as TmdbMovieDetails
        return (await detailRes.json()) as TmdbMovieDetails
      } catch {
        return movie as TmdbMovieDetails
      }
    }),
  )

  return detailed.map((m) => mapTmdb(m))
}

async function fetchTmdbWithBearer(
  token: string,
  _areaLabel: string,
  limit: number,
): Promise<Place[]> {
  const listRes = await fetch(
    'https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  )
  if (!listRes.ok) {
    const text = await listRes.text()
    throw new Error(`TMDB ${listRes.status}: ${text.slice(0, 180)}`)
  }

  const listData = (await listRes.json()) as { results?: TmdbMovieListItem[] }
  const movies = (listData.results ?? []).slice(0, limit)

  const detailed = await Promise.all(
    movies.map(async (movie) => {
      try {
        const detailRes = await fetch(
          `https://api.themoviedb.org/3/movie/${movie.id}?language=en-US`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          },
        )
        if (!detailRes.ok) return movie as TmdbMovieDetails
        return (await detailRes.json()) as TmdbMovieDetails
      } catch {
        return movie as TmdbMovieDetails
      }
    }),
  )

  return detailed.map((m) => mapTmdb(m))
}

function buildOverpassQuery(
  tags: OsmTag[],
  lat: number,
  lng: number,
  radiusMeters: number,
): string {
  // Cap tag fan-out so the public Overpass instance stays happy.
  const selected = tags.slice(0, 8)
  const clauses = selected
    .map((t) => {
      const filter = `["${t.key}"="${t.value}"](around:${radiusMeters},${lat},${lng})`
      return `node${filter};way${filter};relation${filter};`
    })
    .join('\n')

  return `
[out:json][timeout:25];
(
${clauses}
);
out center ${OVERPASS_LIMIT};
`.trim()
}

async function fetchOverpass(
  origin: GeoPoint,
  interests: InterestId[],
  radiusMeters: number,
): Promise<Place[]> {
  const tagList: OsmTag[] = []
  const seen = new Set<string>()
  for (const id of interests) {
    for (const tag of OVERPASS_TAGS[id] ?? []) {
      const key = `${tag.key}=${tag.value}`
      if (seen.has(key)) continue
      seen.add(key)
      tagList.push(tag)
    }
  }
  if (tagList.length === 0) return []

  const query = buildOverpassQuery(tagList, origin.lat, origin.lng, radiusMeters)
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'GoApp/1.0 (discovery; contact: local-dev)',
    },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Overpass ${res.status}: ${text.slice(0, 180)}`)
  }

  const data = (await res.json()) as { elements?: OverpassElement[] }
  const elements = data.elements ?? []
  const tagByKv = new Map(
    tagList.map((t) => [`${t.key}=${t.value}`, t.label] as const),
  )

  const places: Place[] = []
  const used = new Set<string>()
  for (const el of elements) {
    const tags = el.tags ?? {}
    let hint = 'Attraction'
    for (const [kv, label] of tagByKv) {
      const [k, v] = kv.split('=')
      if (k && v && tags[k] === v) {
        hint = label
        break
      }
    }
    const place = mapOverpass(el, origin, hint)
    if (!place || used.has(place.id)) continue
    used.add(place.id)
    places.push(place)
    if (places.length >= OVERPASS_LIMIT) break
  }
  return places
}

async function fetchTicketmaster(
  apiKey: string,
  origin: GeoPoint,
  interests: InterestId[],
  radiusKm: number,
): Promise<Place[]> {
  const classifications = [
    ...new Set(
      interests
        .map((id) => TICKETMASTER_CLASSIFICATIONS[id])
        .filter((c): c is string => Boolean(c)),
    ),
  ]
  if (classifications.length === 0) return []

  const radius = Math.min(100, Math.max(1, Math.round(radiusKm || 40)))
  const results: Place[] = []
  const seen = new Set<string>()

  for (const classification of classifications) {
    const params = new URLSearchParams({
      apikey: apiKey,
      latlong: `${origin.lat},${origin.lng}`,
      radius: String(radius),
      unit: 'km',
      classificationName: classification,
      size: String(Math.min(200, TICKETMASTER_LIMIT)),
      sort: 'date,asc',
    })

    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ticketmaster ${res.status}: ${text.slice(0, 180)}`)
    }

    const data = (await res.json()) as {
      _embedded?: { events?: TicketmasterEvent[] }
    }
    for (const event of data._embedded?.events ?? []) {
      const place = mapTicketmaster(event, origin)
      if (!place || seen.has(place.id)) continue
      seen.add(place.id)
      results.push(place)
    }
  }

  return results.slice(0, TICKETMASTER_LIMIT)
}

/**
 * Round-robin merge weighted toward preferred buckets so food doesn't dominate.
 * Exhausts every unique place across buckets (no artificial total cap).
 */
function mergeByInterest(buckets: Place[][]): Place[] {
  const out: Place[] = []
  const seen = new Set<string>()
  const indices = buckets.map(() => 0)

  for (;;) {
    let progressed = false
    for (let b = 0; b < buckets.length; b++) {
      const bucket = buckets[b]!
      let i = indices[b]!
      while (i < bucket.length) {
        const place = bucket[i++]!
        indices[b] = i
        if (seen.has(place.id)) continue
        seen.add(place.id)
        out.push(place)
        progressed = true
        break
      }
    }
    if (!progressed) break
  }
  return out
}

function needsOverpass(interests: InterestId[]): boolean {
  return interests.some((id) => (OVERPASS_TAGS[id]?.length ?? 0) > 0)
}

function needsTicketmaster(interests: InterestId[]): boolean {
  return interests.some((id) => Boolean(TICKETMASTER_CLASSIFICATIONS[id]))
}

function needsTmdb(interests: InterestId[]): boolean {
  return interests.includes('movies')
}

function needsYelp(interests: InterestId[]): boolean {
  return interests.some((id) => id !== 'movies' && Boolean(YELP_CATEGORIES[id] || YELP_TERMS[id]))
}

export async function handleDiscover(
  location: string,
  keys?: { yelpKey?: string; tmdbKey?: string; ticketmasterKey?: string },
  options?: { radiusKm?: number; interests?: string | InterestId[] },
): Promise<ApiResult> {
  const trimmed = location.trim()
  if (!trimmed) {
    return { status: 400, body: { error: 'location query param is required' } }
  }

  const rawKm =
    typeof options?.radiusKm === 'number' && Number.isFinite(options.radiusKm)
      ? options.radiusKm
      : 40
  const radiusKm = Math.min(800, Math.max(0, rawKm))

  let yelpRadiusMeters: number | null
  if (radiusKm <= 0) {
    yelpRadiusMeters = 400
  } else if (radiusKm > 40) {
    yelpRadiusMeters = null
  } else {
    yelpRadiusMeters = Math.min(
      40000,
      Math.max(400, Math.round(radiusKm * 1000)),
    )
  }

  const overpassRadiusMeters = Math.min(
    50000,
    Math.max(
      800,
      Math.round((radiusKm <= 0 ? 0.4 : Math.min(radiusKm, 50)) * 1000),
    ),
  )

  const interests: InterestId[] =
    typeof options?.interests === 'string'
      ? parseInterestIds(options.interests)
      : Array.isArray(options?.interests) && options.interests.length > 0
        ? (options.interests as InterestId[]).slice(0, 5)
        : []

  const activeInterests =
    interests.length > 0 ? interests : DEFAULT_DISCOVER_INTERESTS

  const yelpKey =
    keys?.yelpKey?.trim() || process.env.YELP_API_KEY?.trim() || ''
  const tmdbKey =
    keys?.tmdbKey?.trim() ||
    process.env.TMDB_API_KEY?.trim() ||
    process.env.TMDB_READ_ACCESS_TOKEN?.trim() ||
    ''
  const ticketmasterKey =
    keys?.ticketmasterKey?.trim() ||
    process.env.TICKETMASTER_API_KEY?.trim() ||
    ''

  const hasYelp = Boolean(yelpKey)
  const hasTmdb = Boolean(tmdbKey)
  const hasTicketmaster = Boolean(ticketmasterKey)
  const wantOverpass = needsOverpass(activeInterests)
  const wantTm = needsTicketmaster(activeInterests) && hasTicketmaster
  const wantTmdb = needsTmdb(activeInterests) && hasTmdb
  const wantYelp = needsYelp(activeInterests) && hasYelp

  const errors: string[] = []
  let origin: GeoPoint | null = null

  if (wantOverpass || wantTm) {
    try {
      origin = await geocodeLocation(trimmed)
      if (!origin) errors.push('Could not geocode location for map/event search')
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Geocode failed')
    }
  }

  const yelpBuckets: Place[][] = []
  let overpassPlaces: Place[] = []
  let ticketmasterPlaces: Place[] = []
  let tmdbPlaces: Place[] = []

  const tasks: Promise<void>[] = []

  if (wantYelp) {
    for (const interest of activeInterests) {
      if (interest === 'movies') continue
      if (!YELP_CATEGORIES[interest] && !YELP_TERMS[interest]) continue
      tasks.push(
        (async () => {
          try {
            const places = await fetchYelpForInterest(
              yelpKey,
              trimmed,
              interest,
              YELP_PER_INTEREST,
              yelpRadiusMeters,
            )
            if (places.length) yelpBuckets.push(places)
          } catch (err) {
            errors.push(
              err instanceof Error
                ? err.message
                : `Yelp failed for ${interest}`,
            )
          }
        })(),
      )
    }
  }

  if (wantOverpass && origin) {
    const geo = origin
    tasks.push(
      (async () => {
        try {
          overpassPlaces = await fetchOverpass(
            geo,
            activeInterests,
            overpassRadiusMeters,
          )
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Overpass failed')
        }
      })(),
    )
  }

  if (wantTm && origin) {
    const geo = origin
    tasks.push(
      (async () => {
        try {
          ticketmasterPlaces = await fetchTicketmaster(
            ticketmasterKey,
            geo,
            activeInterests,
            radiusKm <= 0 ? 8 : radiusKm,
          )
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : 'Ticketmaster failed',
          )
        }
      })(),
    )
  }

  if (wantTmdb) {
    tasks.push(
      (async () => {
        try {
          tmdbPlaces = tmdbKey.startsWith('eyJ')
            ? await fetchTmdbWithBearer(tmdbKey, trimmed, TMDB_LIMIT)
            : await fetchTmdb(tmdbKey, trimmed, TMDB_LIMIT)
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'TMDB failed')
        }
      })(),
    )
  }

  await Promise.all(tasks)

  // Prefer OSM + events + interest Yelp buckets; TMDB if movies selected.
  // Food-heavy buckets still appear but share the round-robin with others.
  const mergeBuckets: Place[][] = []
  if (overpassPlaces.length) mergeBuckets.push(overpassPlaces)
  if (ticketmasterPlaces.length) mergeBuckets.push(ticketmasterPlaces)
  if (tmdbPlaces.length) mergeBuckets.push(tmdbPlaces)
  for (const bucket of yelpBuckets) mergeBuckets.push(bucket)

  const places = mergeByInterest(mergeBuckets)

  if (places.length === 0) {
    return {
      status: 200,
      body: {
        places: [],
        sources: {
          yelp: false,
          tmdb: false,
          overpass: false,
          ticketmaster: false,
          fallback: true,
        },
        radiusKm,
        interests: activeInterests,
        errors,
        message:
          'No live results — check location, API keys (Yelp / TMDB / Ticketmaster), or try a wider radius.',
      },
    }
  }

  return {
    status: 200,
    body: {
      places,
      sources: {
        yelp: yelpBuckets.some((b) => b.length > 0),
        tmdb: tmdbPlaces.length > 0,
        overpass: overpassPlaces.length > 0,
        ticketmaster: ticketmasterPlaces.length > 0,
        fallback: false,
      },
      radiusKm,
      interests: activeInterests,
      errors: errors.length ? errors : undefined,
    },
  }
}
