/**
 * Onboarding — Reddit-style first-run prefs
 *
 * Steps: age → interests → location → travel radius (slider + map).
 * Stored locally so returning visitors skip straight to a personalized Feed.
 */

import { useState, type ComponentType, type FormEvent } from 'react'
import {
  ArrowLeft,
  Clapperboard,
  Coffee,
  Dumbbell,
  Footprints,
  Gamepad2,
  HeartPulse,
  IceCreamCone,
  MapPin,
  Music2,
  Palette,
  PawPrint,
  Route,
  ShoppingBag,
  Sparkles,
  Trees,
  Utensils,
  Wine,
} from 'lucide-react'
import {
  AGE_RANGES,
  DEFAULT_TRAVEL_MILES,
  INTERESTS,
  MAX_INTERESTS,
  MAX_TRAVEL_MILES,
  MIN_TRAVEL_MILES,
  type AgeRangeId,
  type InterestId,
} from '../data/interests'
import { TravelRadiusMap } from './TravelRadiusMap'

type Step = 'age' | 'interests' | 'location' | 'distance'

const INTEREST_ICONS: Record<InterestId, ComponentType<{ className?: string }>> =
  {
    food: Utensils,
    outdoors: Trees,
    nightlife: Wine,
    movies: Clapperboard,
    coffee: Coffee,
    arts: Palette,
    fitness: Dumbbell,
    music: Music2,
    shopping: ShoppingBag,
    games: Gamepad2,
    sweets: IceCreamCone,
    chill: Footprints,
    travel: MapPin,
    pets: PawPrint,
    wellness: HeartPulse,
  }

interface OnboardingProps {
  /** Prefill location when the user already set one earlier. */
  initialLocation?: string
  /** Skip the location step when already known. */
  skipLocation?: boolean
  busy?: boolean
  error?: string | null
  onComplete: (result: {
    ageRange: AgeRangeId
    interests: InterestId[]
    maxDistanceMiles: number
    location: string
  }) => void
}

export function Onboarding({
  initialLocation = '',
  skipLocation = false,
  busy = false,
  error = null,
  onComplete,
}: OnboardingProps) {
  const [step, setStep] = useState<Step>('age')
  const [ageRange, setAgeRange] = useState<AgeRangeId | null>(null)
  const [interests, setInterests] = useState<InterestId[]>([])
  const [maxDistanceMiles, setMaxDistanceMiles] = useState(DEFAULT_TRAVEL_MILES)
  const [location, setLocation] = useState(initialLocation)

  const stepOrder: Step[] = skipLocation
    ? ['age', 'interests', 'distance']
    : ['age', 'interests', 'location', 'distance']
  const stepIndex = Math.max(0, stepOrder.indexOf(step))
  const totalSteps = stepOrder.length
  const mapLocation = location.trim() || initialLocation.trim()

  const toggleInterest = (id: InterestId) => {
    setInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_INTERESTS) return prev
      return [...prev, id]
    })
  }

  const goBack = () => {
    if (step === 'interests') setStep('age')
    else if (step === 'location') setStep('interests')
    else if (step === 'distance') {
      setStep(skipLocation ? 'interests' : 'location')
    }
  }

  const finish = () => {
    if (!ageRange || interests.length === 0 || !mapLocation) return
    onComplete({
      ageRange,
      interests,
      maxDistanceMiles,
      location: mapLocation,
    })
  }

  const handleLocationSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!location.trim()) return
    setStep('distance')
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      <div className="px-5 pt-6">
        <div className="mb-5 flex items-center gap-3">
          {step !== 'age' ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-black/5"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Welcome to Go!
            </p>
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <span
                  key={i}
                  className={[
                    'h-1 flex-1 rounded-full transition',
                    i <= stepIndex ? 'bg-primary' : 'bg-gray-200',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {step === 'age' ? (
          <section>
            <h1 className="text-2xl font-bold text-gray-900">
              How old are you?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Approximate is fine — we use it to nudge suggestions toward your
              vibe, not to lock anything out.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {AGE_RANGES.map((option) => {
                const selected = ageRange === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAgeRange(option.id)}
                    className={[
                      'rounded-2xl px-3 py-3.5 text-left transition ring-2',
                      selected
                        ? 'bg-primary text-white ring-primary'
                        : 'bg-white text-gray-900 ring-transparent hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p
                      className={[
                        'mt-0.5 text-xs',
                        selected ? 'text-white/80' : 'text-muted',
                      ].join(' ')}
                    >
                      {option.hint}
                    </p>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={!ageRange}
              onClick={() => ageRange && setStep('interests')}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </section>
        ) : null}

        {step === 'interests' ? (
          <section>
            <h1 className="text-2xl font-bold text-gray-900">
              What are you into?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Pick up to {MAX_INTERESTS}. We’ll still show everything nearby —
              just sprinkle your favorites in more often.
            </p>
            <p className="mt-3 text-xs font-medium text-muted">
              {interests.length}/{MAX_INTERESTS} selected
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTERESTS.map((interest) => {
                const selected = interests.includes(interest.id)
                const full = interests.length >= MAX_INTERESTS && !selected
                const Icon = INTEREST_ICONS[interest.id]
                return (
                  <button
                    key={interest.id}
                    type="button"
                    disabled={full}
                    onClick={() => toggleInterest(interest.id)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ring-1',
                      selected
                        ? 'bg-primary text-white ring-primary'
                        : full
                          ? 'bg-gray-100 text-gray-400 ring-transparent'
                          : 'bg-white text-gray-800 ring-black/5 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {interest.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={interests.length === 0}
              onClick={() =>
                setStep(skipLocation && initialLocation.trim() ? 'distance' : 'location')
              }
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </section>
        ) : null}

        {step === 'location' ? (
          <section>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Where are you?</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              City, neighborhood, or ZIP — next you’ll draw how far you’re
              willing to roam.
            </p>
            <form onSubmit={handleLocationSubmit} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  City or ZIP
                </span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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
                disabled={!location.trim()}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                Continue
              </button>
            </form>
          </section>
        ) : null}

        {step === 'distance' ? (
          <section>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Route className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              How far will you go?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Drag the slider — the circle on the map is your travel bubble.
            </p>

            <div className="mt-4">
              {mapLocation ? (
                <TravelRadiusMap
                  location={mapLocation}
                  miles={maxDistanceMiles}
                />
              ) : null}
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Max distance
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
                    {maxDistanceMiles}
                    <span className="ml-1 text-base font-semibold text-muted">
                      mi
                    </span>
                  </p>
                </div>
                <p className="pb-1 text-xs text-muted">
                  {MIN_TRAVEL_MILES}–{MAX_TRAVEL_MILES} mi
                </p>
              </div>

              <input
                type="range"
                min={MIN_TRAVEL_MILES}
                max={MAX_TRAVEL_MILES}
                step={1}
                value={maxDistanceMiles}
                onChange={(e) => setMaxDistanceMiles(Number(e.target.value))}
                className="mt-4 w-full accent-primary"
                aria-label="Maximum travel distance in miles"
              />

              <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
                <span>Stay local</span>
                <span>Road trip</span>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy || !mapLocation}
              onClick={finish}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? 'Finding spots…' : "Show me what's nearby"}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  )
}
