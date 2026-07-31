/**
 * Event Setup (`/event/:groupId`) — shortlist places, then open a live room
 *
 * Vision: the host seeds a few options from Go-Tos (0–5), then Start Event
 * creates a shareable 4-digit room. Friends join via code/link and can add more
 * spots before everyone votes.
 */

import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { createRoom } from '../api/rooms'
import { useStore } from '../store/useStore'
import {
  getDisplayName,
  setDisplayName,
  setRoomMemberId,
} from '../utils/session'
import { priceLabel } from '../utils/price'

const MAX_SELECTION = 5

/** Checkbox list of saved places for the active group. */
export function EventSetup() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const groups = useStore((s) => s.groups)
  const getSavedPlaces = useStore((s) => s.getSavedPlaces)
  const savedPlaces = getSavedPlaces()

  const group = useMemo(
    () => groups.find((g) => g.id === groupId),
    [groups, groupId],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hostName, setHostName] = useState(getDisplayName() || 'Host')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!group) {
    return <Navigate to="/groups" replace />
  }

  const togglePlace = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SELECTION) return prev
      return [...prev, id]
    })
  }

  const handleStart = async () => {
    const name = hostName.trim()
    if (!name) {
      setError('Enter your name so friends know who started the room')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const { room, memberId } = await createRoom({
        groupId: group.id,
        groupName: group.name,
        hostName: name,
        placeIds: selectedIds,
      })
      setDisplayName(name)
      setRoomMemberId(room.code, memberId)
      navigate(`/room/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start event')
    } finally {
      setBusy(false)
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Start Event</h1>
        <p className="mt-1 text-sm text-muted">
          Seed up to {MAX_SELECTION} places for{' '}
          <span className="font-medium text-gray-800">{group.name}</span>. Friends
          can add more after they join.
        </p>
        <p className="mt-2 text-xs font-medium text-primary">
          {selectedIds.length} selected
        </p>
      </header>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700">
          Your name (shown as host)
        </span>
        <input
          type="text"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="Alex"
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
        />
      </label>

      {savedPlaces.length === 0 ? (
        <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-black/5">
          <p className="font-medium text-gray-800">No saved places yet</p>
          <p className="mt-1 text-sm text-muted">
            You can still start an empty room — friends add from their Go-Tos.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-semibold text-primary"
          >
            Or save places from Feed →
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

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="sticky bottom-4 mt-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStart()}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition enabled:hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Creating room…' : 'Start Event'}
        </button>
      </div>
    </div>
  )
}
