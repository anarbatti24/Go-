/**
 * Vercel serverless — GET /api/discover?location=...&interests=...
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleDiscover } from '../server/lib/discover.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const location = String(req.query.location ?? '')
  const radiusRaw = req.query.radiusKm ?? req.query.radiusMiles
  let radiusKm: number | undefined
  if (typeof radiusRaw === 'string' || typeof radiusRaw === 'number') {
    const n = Number(radiusRaw)
    if (Number.isFinite(n)) {
      // Legacy clients sent miles via radiusMiles.
      radiusKm =
        req.query.radiusKm != null
          ? n
          : Math.round(n * 1.609344)
    }
  }
  const interestsRaw = req.query.interests
  const interests =
    typeof interestsRaw === 'string'
      ? interestsRaw
      : Array.isArray(interestsRaw)
        ? interestsRaw.filter((v): v is string => typeof v === 'string').join(',')
        : undefined

  const result = await handleDiscover(location, undefined, {
    radiusKm,
    interests,
  })
  res.status(result.status).json(result.body)
}
