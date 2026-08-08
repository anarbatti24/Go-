/**
 * Location prompt — ask for a verified place before loading nearby results.
 */

import { useState, type FormEvent } from 'react'
import { MapPin } from 'lucide-react'
import type { PlaceSuggestion } from '../api/photon'
import { LocationAutocomplete } from './LocationAutocomplete'

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
  const [place, setPlace] = useState<PlaceSuggestion | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!place) return
    onSubmit(place.label)
  }

  return (
    <div className="flex h-full flex-col justify-center bg-[var(--color-bg)] px-5">
      <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Where are you?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Pick a real address, city, or ZIP so we can pull spots nearby —
          attractions, events, food, and movies matched to your interests.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <LocationAutocomplete
            value={place}
            onChange={setPlace}
            initialQuery={initialValue}
            autoFocus
            disabled={busy}
          />

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !place}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? 'Finding spots…' : "Show me what's nearby"}
          </button>
        </form>
      </div>
    </div>
  )
}
