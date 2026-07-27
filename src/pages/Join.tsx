/**
 * Join Event (`/join` or `/join/:code`) — enter a room with a 4-digit code
 *
 * Vision: friends who weren't the host shouldn't need to recreate a group.
 * They open the invite link (or type the code), pick a display name, and land
 * in the shared room to add roams + vote.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { joinRoom } from '../api/rooms'
import {
  getDisplayName,
  setDisplayName,
  setRoomMemberId,
} from '../utils/session'

export function Join() {
  const { code: codeParam } = useParams<{ code?: string }>()
  const navigate = useNavigate()

  const [code, setCode] = useState(codeParam ?? '')
  const [name, setName] = useState(getDisplayName())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const cleanCode = code.replace(/\D/g, '').slice(0, 4)
    const cleanName = name.trim()
    if (cleanCode.length !== 4) {
      setError('Enter a 4-digit room code')
      return
    }
    if (!cleanName) {
      setError('Enter a display name')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const { memberId } = await joinRoom(cleanCode, cleanName)
      setDisplayName(cleanName)
      setRoomMemberId(cleanCode, memberId)
      navigate(`/room/${cleanCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room')
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
        <h1 className="text-2xl font-bold text-gray-900">Join Event</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the 4-digit code your friend shared.
        </p>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Room code
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4821"
            className="w-full rounded-xl border border-border bg-white px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none ring-primary focus:ring-2"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Your name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
            required
          />
        </label>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join Room'}
        </button>
      </form>
    </div>
  )
}
