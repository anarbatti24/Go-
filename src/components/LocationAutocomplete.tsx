/**
 * Photon-backed location typeahead.
 * User must pick a suggestion (or “use my location”) — free-text alone won’t pass.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Loader2, MapPin, Navigation } from 'lucide-react'
import {
  reverseGeocode,
  searchPlaces,
  type PlaceSuggestion,
} from '../api/photon'

interface LocationAutocompleteProps {
  value: PlaceSuggestion | null
  onChange: (place: PlaceSuggestion | null) => void
  /** Seed the text field when editing a previously saved location string. */
  initialQuery?: string
  label?: string
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
}

export function LocationAutocomplete({
  value,
  onChange,
  initialQuery = '',
  label = 'Address, city, postal code, or ZIP',
  placeholder = 'e.g. 123 Main St or M5V 3L9',
  autoFocus = false,
  disabled = false,
}: LocationAutocompleteProps) {
  const listId = useId()
  const blurTimer = useRef<number | null>(null)
  const biasRef = useRef<{ lat: number; lng: number } | null>(null)
  const [query, setQuery] = useState(value?.label || initialQuery)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (value && trimmed === value.label.trim()) {
      setSuggestions([])
      setLoading(false)
      return
    }

    if (trimmed.length < 2) {
      setSuggestions([])
      setLoading(false)
      setHint(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setHint(null)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchPlaces(trimmed, 6, {
            bias: biasRef.current,
          })
          if (cancelled) return
          setSuggestions(results)
          setOpen(true)
          setActiveIndex(-1)
          if (results.length === 0) {
            setHint(
              'No matching places — try a city, postal code, or ZIP.',
            )
          }
        } catch {
          if (cancelled) return
          setSuggestions([])
          setHint('Couldn’t search places right now. Try again in a moment.')
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, value])

  const selectPlace = useCallback(
    (place: PlaceSuggestion) => {
      biasRef.current = { lat: place.lat, lng: place.lng }
      onChange(place)
      setQuery(place.label)
      setSuggestions([])
      setOpen(false)
      setActiveIndex(-1)
      setHint(null)
      setGeoError(null)
    },
    [onChange],
  )

  const handleQueryChange = (next: string) => {
    setQuery(next)
    setGeoError(null)
    if (value && next.trim() !== value.label.trim()) {
      onChange(null)
    }
    setOpen(true)
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Location isn’t available in this browser.')
      return
    }

    setGeoBusy(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          try {
            biasRef.current = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }
            const place = await reverseGeocode(
              pos.coords.latitude,
              pos.coords.longitude,
            )
            if (!place) {
              setGeoError('Couldn’t resolve your current location.')
              return
            }
            selectPlace(place)
          } catch {
            setGeoError('Couldn’t resolve your current location.')
          } finally {
            setGeoBusy(false)
          }
        })()
      },
      () => {
        setGeoBusy(false)
        setGeoError('Allow location access, or type an address instead.')
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const pick = suggestions[activeIndex]
      if (pick) selectPlace(pick)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </span>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current)
              if (suggestions.length > 0) setOpen(true)
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 150)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={disabled || geoBusy}
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-10 text-sm outline-none ring-primary focus:ring-2 disabled:opacity-60"
          />
          {loading || geoBusy ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
          ) : null}

          {open && suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg"
            >
              {suggestions.map((place, index) => {
                const active = index === activeIndex
                return (
                  <li key={place.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      id={`${listId}-opt-${index}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectPlace(place)}
                      className={[
                        'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition',
                        active ? 'bg-primary/10 text-gray-900' : 'hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="leading-snug">{place.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </label>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={disabled || geoBusy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition hover:text-primary-dark disabled:opacity-50"
      >
        <Navigation className="h-3.5 w-3.5" />
        {geoBusy ? 'Locating…' : 'Use my current location'}
      </button>

      {value ? (
        <p className="text-xs text-muted">Selected: {value.label}</p>
      ) : query.trim().length >= 2 ? (
        <p className="text-xs text-amber-700">
          Pick a result from the list so we know the place is real.
        </p>
      ) : null}

      {hint && !value ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}

      {geoError ? (
        <p className="text-xs text-red-600">{geoError}</p>
      ) : null}
    </div>
  )
}
