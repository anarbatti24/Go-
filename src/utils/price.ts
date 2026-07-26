/**
 * Price display helpers
 *
 * Vision: Go! communicates cost as a vibe, not a receipt. We store a 1–4 scale
 * on each Place and render it as money-bag emojis so cards stay scannable.
 */

/**
 * Convert a numeric price level into a money-bag string.
 * Example: `2` → "💰💰"
 */
export function priceLabel(price: 1 | 2 | 3 | 4): string {
  return '💰'.repeat(price)
}
