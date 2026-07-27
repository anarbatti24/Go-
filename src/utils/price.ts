/**
 * Price / rating display helpers
 *
 * Vision: Go! communicates cost as a vibe (money bags) and ratings as stars /
 * scores depending on the source (Yelp vs TMDB).
 */

/** Convert a numeric price level into money bags, or a dash when unknown. */
export function priceLabel(price: 1 | 2 | 3 | 4 | null | undefined): string {
  if (!price) return '—'
  return '💰'.repeat(price)
}

/** Format a rating for the reel footer / detail sheet. */
export function ratingLabel(
  rating: number | undefined,
  source: 'yelp' | 'tmdb' | 'sample',
): string | null {
  if (rating == null || Number.isNaN(rating)) return null
  if (source === 'tmdb') return `${rating.toFixed(1)}/10`
  return `${rating.toFixed(1)}★`
}

/** Movie runtime like "1h 48m". */
export function runtimeLabel(minutes: number | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}
