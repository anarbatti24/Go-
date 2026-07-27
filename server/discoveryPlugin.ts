/**
 * Vite plugin — discovery API during `npm run dev`
 * Production uses Vercel `/api/discover`.
 */

import type { ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { handleDiscover } from './lib/discover.ts'

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
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
          const result = await handleDiscover(location, { yelpKey, tmdbKey })
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
