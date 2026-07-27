/**
 * Vite plugin — Yelp + TMDB discovery proxy
 *
 * Vision: keep API keys on the server during `npm run dev`, map both APIs into
 * Go!'s shared `Place` shape, and return ~30 nearby things to do (food,
 * activities, movies). Falls back to sample places when keys are missing.
 */

import type { ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'

const TOTAL_LIMIT = 30
const YELP_LIMIT = 20
const TMDB_LIMIT = 10

type PlaceSource = 'yelp' | 'tmdb' | 'sample'

interface Place {
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

interface YelpBusiness {
  id: string
  name: string
  image_url?: string
  url?: string
  review_count?: number
  rating?: number
  price?: string
  distance?: number
  categories?: { alias: string; title: string }[]
  location?: {
    address1?: string
    city?: string
    state?: string
    zip_code?: string
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
  release_date?: string
}

interface TmdbMovieDetails extends TmdbMovieListItem {
  runtime?: number
  genres?: { id: number; name: string }[]
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

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function metersToMiles(meters: number | undefined): string {
  if (meters == null || Number.isNaN(meters)) return 'Nearby'
  const miles = meters / 1609.344
  if (miles < 0.1) return '<0.1 mi'
  return `${miles.toFixed(1)} mi`
}

function yelpPrice(price: string | undefined): 1 | 2 | 3 | 4 | null {
  if (!price) return null
  const level = Math.min(4, Math.max(1, price.length)) as 1 | 2 | 3 | 4
  return level
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
    distance: metersToMiles(biz.distance),
    location: address,
    category: cuisine || 'Food & Drink',
    source: 'yelp',
    rating: biz.rating,
    genres: genreTitles,
    cuisine,
  }
}

function mapTmdb(movie: TmdbMovieDetails, areaLabel: string): Place {
  const genres =
    movie.genres?.map((g) => g.name) ||
    (movie.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean)
  const primary = genres[0] || 'Movie'
  const poster =
    movie.poster_path || movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path || movie.backdrop_path}`
      : `https://picsum.photos/seed/tmdb-${movie.id}/720/1280`

  const overview =
    movie.overview?.trim() ||
    'Now playing — grab seats and make a night of it.'

  return {
    id: `tmdb-${movie.id}`,
    name: movie.title,
    description: overview,
    image: poster,
    price: 2,
    distance: 'In theaters',
    location: areaLabel ? `Near ${areaLabel}` : 'In theaters',
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

/** Interleave sources so the feed mixes food + movies instead of stacking. */
function interleave(yelp: Place[], tmdb: Place[], limit: number): Place[] {
  const out: Place[] = []
  let i = 0
  let j = 0
  // Prefer a food, food, movie rhythm
  while (out.length < limit && (i < yelp.length || j < tmdb.length)) {
    if (i < yelp.length) out.push(yelp[i++]!)
    if (out.length >= limit) break
    if (i < yelp.length) out.push(yelp[i++]!)
    if (out.length >= limit) break
    if (j < tmdb.length) out.push(tmdb[j++]!)
  }
  return out.slice(0, limit)
}

async function fetchYelp(
  apiKey: string,
  location: string,
  limit: number,
): Promise<Place[]> {
  const params = new URLSearchParams({
    location,
    term: 'restaurants bars activities',
    categories: 'restaurants,nightlife,active,arts',
    limit: String(Math.min(50, limit)),
    sort_by: 'best_match',
    radius: '16000',
  })

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
  areaLabel: string,
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

  return detailed.map((m) => mapTmdb(m, areaLabel))
}

export function discoveryApiPlugin(): Plugin {
  let yelpKey = ''
  let tmdbKey = ''

  return {
    name: 'go-discovery-api',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), '')
      yelpKey = env.YELP_API_KEY?.trim() || ''
      tmdbKey =
        env.TMDB_API_KEY?.trim() ||
        env.TMDB_READ_ACCESS_TOKEN?.trim() ||
        ''
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/discover')) {
          next()
          return
        }

        try {
          if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }

          const parsed = new URL(url, 'http://localhost')
          const location = (parsed.searchParams.get('location') || '').trim()
          if (!location) {
            sendJson(res, 400, { error: 'location query param is required' })
            return
          }

          const hasYelp = Boolean(yelpKey)
          const hasTmdb = Boolean(tmdbKey)

          if (!hasYelp && !hasTmdb) {
            sendJson(res, 200, {
              places: [],
              sources: { yelp: false, tmdb: false, fallback: true },
              message:
                'Add YELP_API_KEY and TMDB_API_KEY to .env, then restart npm run dev.',
            })
            return
          }

          const errors: string[] = []
          let yelpPlaces: Place[] = []
          let tmdbPlaces: Place[] = []

          if (hasYelp) {
            try {
              yelpPlaces = await fetchYelp(yelpKey, location, YELP_LIMIT)
            } catch (err) {
              errors.push(err instanceof Error ? err.message : 'Yelp failed')
            }
          }

          if (hasTmdb) {
            try {
              // TMDB v3 API key (query param). If user pasted a JWT read token,
              // try Bearer auth instead.
              if (tmdbKey.startsWith('eyJ')) {
                tmdbPlaces = await fetchTmdbWithBearer(
                  tmdbKey,
                  location,
                  TMDB_LIMIT,
                )
              } else {
                tmdbPlaces = await fetchTmdb(tmdbKey, location, TMDB_LIMIT)
              }
            } catch (err) {
              errors.push(err instanceof Error ? err.message : 'TMDB failed')
            }
          }

          let places = interleave(yelpPlaces, tmdbPlaces, TOTAL_LIMIT)

          if (places.length === 0) {
            sendJson(res, 200, {
              places: [],
              sources: {
                yelp: hasYelp,
                tmdb: hasTmdb,
                fallback: true,
              },
              errors,
              message: 'Live APIs returned nothing — check your keys / location.',
            })
            return
          }

          sendJson(res, 200, {
            places,
            sources: {
              yelp: yelpPlaces.length > 0,
              tmdb: tmdbPlaces.length > 0,
              fallback: false,
            },
            errors: errors.length ? errors : undefined,
          })
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Discover failed',
          })
        }
      })
    },
  }
}

async function fetchTmdbWithBearer(
  token: string,
  areaLabel: string,
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

  return detailed.map((m) => mapTmdb(m, areaLabel))
}
