/**
 * Quick health check for rooms backend on Vercel.
 * GET /api/rooms-health
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getRoomStore } from '../server/lib/roomStore.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const store = getRoomStore()
    const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim())
    const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim())

    // Light Redis ping via EXISTS on a missing key
    let redisOk: boolean | null = null
    let redisError: string | null = null
    if (store.backend === 'redis') {
      try {
        await store.has('__health__')
        redisOk = true
      } catch (err) {
        redisOk = false
        redisError = err instanceof Error ? err.message : 'Redis failed'
      }
    }

    res.status(200).json({
      ok: true,
      store: store.backend,
      env: { hasUrl, hasToken },
      redisOk,
      redisError,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    })
  }
}
