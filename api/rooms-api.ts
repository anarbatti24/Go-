/**
 * Vercel serverless — all room routes land here via vercel.json rewrites.
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

function parseBody(req: VercelRequest): unknown {
  const body = req.body
  if (body == null || body === '') return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return body
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')

  try {
    const path = buildPath(req)
    const method = (req.method ?? 'GET').toUpperCase()
    const body = method === 'GET' || method === 'HEAD' ? {} : parseBody(req)

    const result = await handleRoomsRequest(method, path, body)
    res.status(result.status).json(result.body)
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Server error',
      hint: 'Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on Vercel.',
    })
  }
}
