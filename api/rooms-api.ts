/**
 * Vercel serverless — all room routes land here via vercel.json rewrites.
 *
 * Nested `api/rooms/[[...slug]]` is unreliable with the Vite preset, so we use
 * a single top-level function (same pattern as `/api/discover`).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleRoomsRequest } from '../server/lib/rooms.js'

function buildPath(req: VercelRequest): string {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const action = typeof req.query.action === 'string' ? req.query.action : ''

  if (code && action) return `/api/rooms/${code}/${action}`
  if (code) return `/api/rooms/${code}`
  return '/api/rooms'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const path = buildPath(req)
    const method = (req.method ?? 'GET').toUpperCase()
    const body = method === 'GET' || method === 'HEAD' ? {} : (req.body ?? {})

    const result = await handleRoomsRequest(method, path, body)
    res.status(result.status).json(result.body)
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Server error',
    })
  }
}
