/**
 * Vite plugin — discovery API during `npm run dev`
 * Production uses Vercel `/api/discover`.
 */

import type { ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { handleDiscover } from './lib/discover.js'

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function discoveryApiPlugin(): Plugin {
  let yelpKey = ''
  let tmdbKey = ''
  let ticketmasterKey = ''

  return {
    name: 'go-discovery-api',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), '')
      yelpKey = env.YELP_API_KEY?.trim() || ''
      tmdbKey =
        env.TMDB_API_KEY?.trim() ||
        env.TMDB_READ_ACCESS_TOKEN?.trim() ||
        ''
      ticketmasterKey = env.TICKETMASTER_API_KEY?.trim() || ''
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
          const radiusKmRaw = parsed.searchParams.get('radiusKm')
          const radiusMilesRaw = parsed.searchParams.get('radiusMiles')
          let radiusKm: number | undefined
          if (radiusKmRaw) {
            const n = Number(radiusKmRaw)
            if (Number.isFinite(n)) radiusKm = n
          } else if (radiusMilesRaw) {
            const n = Number(radiusMilesRaw)
            if (Number.isFinite(n)) radiusKm = Math.round(n * 1.609344)
          }
          const interests = parsed.searchParams.get('interests') || undefined
          const result = await handleDiscover(
            location,
            { yelpKey, tmdbKey, ticketmasterKey },
            { radiusKm, interests },
          )
          sendJson(res, result.status, result.body)
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Discover failed',
          })
        }
      })
    },
  }
}
