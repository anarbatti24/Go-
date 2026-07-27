/**
 * Vercel serverless — /api/rooms and /api/rooms/:code/...
 *
 * Optional catch-all so one function covers create, join, vote, etc.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleRoomsRequest } from '../../server/lib/rooms.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug
  const parts = Array.isArray(slug)
    ? slug
    : typeof slug === 'string'
      ? [slug]
      : []

  const suffix = parts.length > 0 ? `/${parts.join('/')}` : ''
  const path = `/api/rooms${suffix}`
  const method = (req.method ?? 'GET').toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? {} : (req.body ?? {})

  const result = await handleRoomsRequest(method, path, body)
  res.status(result.status).json(result.body)
}
