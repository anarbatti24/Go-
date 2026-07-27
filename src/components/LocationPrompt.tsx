/**
 * Location prompt — ask for city / ZIP before loading real nearby results.
 */

import { useState, type FormEvent } from 'react'
import { MapPin } from 'lucide-react'

interface LocationPromptProps {
  initialValue?: string
  busy?: boolean
  error?: string | null
  onSubmit: (location: string) => void
}

export function LocationPrompt({
  initialValue = '',
  busy = false,
  error = null,
  onSubmit,
}: LocationPromptProps) {
  const [value, setValue] = useState(initialValue)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="flex h-full flex-col justify-center bg-[var(--color-bg)] px-5">
      <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Where are you?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Drop a city, neighborhood, or ZIP so we can pull real spots nearby —
          restaurants from Yelp and movies from TMDB.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">
              City or ZIP
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Austin, TX or 78701"
              autoFocus
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? 'Finding spots…' : "Show me what's nearby"}
          </button>
        </form>
      </div>
    </div>
  )
}
