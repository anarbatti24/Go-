/**
 * Event Setup (`/event/:groupId`) — shortlist places for a group vote
 *
 * Vision: before friends vote, someone curates a small set of options from My
 * Roams. Too many choices kill momentum; too few isn't a real vote. We allow
 * 2–5 places — enough to debate, not enough to overwhelm.
 *
 * This screen bridges Groups → Voting:
 *   1. Load the group from the URL param
 *   2. Show only saved places (you can't vote on places nobody bookmarked)
 *   3. On "Start Vote", push the selection into the store and navigate to `/vote`
 */

import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { priceLabel } from '../utils/price'

/** Minimum / maximum places allowed in one voting round. */
const MIN_SELECTION = 2
const MAX_SELECTION = 5

/** Checkbox list of saved places for the active group. */
export function EventSetup() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const groups = useStore((s) => s.groups)
  const getSavedPlaces = useStore((s) => s.getSavedPlaces)
  const setVotingPlaces = useStore((s) => s.setVotingPlaces)
  const savedPlaces = getSavedPlaces()

  /** Resolve the group from the route; invalid ids bounce back to Groups. */
  const group = useMemo(
    () => groups.find((g) => g.id === groupId),
    [groups, groupId],
  )

  /** Local UI selection before we commit it to the voting session. */
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  if (!group) {
    return <Navigate to="/groups" replace />
  }

  /**
   * Toggle a place in the shortlist.
   * Caps at MAX_SELECTION so the Start Vote button's contract stays honest.
   */
  const togglePlace = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SELECTION) return prev
      return [...prev, id]
    })
  }

  const canStart =
    selectedIds.length >= MIN_SELECTION && selectedIds.length <= MAX_SELECTION

  /** Commit selection to the store and open the Voting screen. */
  const handleStart = () => {
    if (!canStart) return
    setVotingPlaces(selectedIds)
    navigate('/vote')
  }

  return (
    <div>
      <header className="mb-5">
        <Link
          to="/groups"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Event Setup</h1>
        <p className="mt-1 text-sm text-muted">
          Pick {MIN_SELECTION}–{MAX_SELECTION} saved places for{' '}
          <span className="font-medium text-gray-800">{group.name}</span>.
        </p>
        <p className="mt-2 text-xs font-medium text-primary">
          {selectedIds.length} selected
        </p>
      </header>

      {savedPlaces.length === 0 ? (
        <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-black/5">
          <p className="font-medium text-gray-800">No saved places yet</p>
          <p className="mt-1 text-sm text-muted">Save places from Feed before starting a vote.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Go to Feed
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {savedPlaces.map((place) => {
            const checked = selectedIds.includes(place.id)
            const disabled = !checked && selectedIds.length >= MAX_SELECTION
            return (
              <li key={place.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => togglePlace(place.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-sm ring-1 transition',
                    checked ? 'ring-primary' : 'ring-black/5',
                    disabled ? 'opacity-50' : 'hover:shadow-md',
                  ].join(' ')}
                >
                  <img
                    src={place.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{place.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {priceLabel(place.price)} · {place.distance}
                    </p>
                  </div>
                  <span
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                      checked
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white',
                    ].join(' ')}
                  >
                    {checked ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky bottom-4 mt-6">
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition enabled:hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start Vote
        </button>
      </div>
    </div>
  )
}
