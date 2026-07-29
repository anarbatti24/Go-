/**
 * Groups (`/groups`) — create crews and share a join code
 *
 * Vision: creating a group immediately spins up a live room with a 4-digit code
 * you can share. Friends join via code/link, add roams, and vote together.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hash, Plus, Users } from 'lucide-react'
import { createRoom } from '../api/rooms'
import { Modal } from '../components/Modal'
import { useStore } from '../store/useStore'
import { createId } from '../utils/id'
import {
  getDisplayName,
  setDisplayName,
  setRoomMemberId,
} from '../utils/session'

/** List of groups + floating create affordance. */
export function Groups() {
  const navigate = useNavigate()
  const groups = useStore((s) => s.groups)
  const addGroup = useStore((s) => s.addGroup)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [hostName, setHostName] = useState(getDisplayName())
  /** Raw comma-separated member input before we split it for the store */
  const [members, setMembers] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * Create the group + live room together, then open the room so the host can
   * copy the 4-digit code / invite link right away.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const groupName = name.trim()
    const you = hostName.trim() || 'Host'
    if (!groupName) return

    setBusy(true)
    setError(null)
    try {
      const memberList = members
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)

      const { room, memberId } = await createRoom({
        groupId: createId(),
        groupName,
        hostName: you,
        placeIds: [],
      })

      setDisplayName(you)
      setRoomMemberId(room.code, memberId)
      addGroup(groupName, memberList, room.code, room.groupId)

      setName('')
      setMembers('')
      setOpen(false)
      navigate(`/room/${room.code}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create group. Is the Go! server running?',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-full">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <p className="mt-1 text-sm text-muted">
          Create a group to get a shareable 4-digit code.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Link
            to="/join"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-primary shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
          >
            <Hash className="h-4 w-4" />
            Join with code
          </Link>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setOpen(true)
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition hover:bg-primary-dark"
            aria-label="Create group"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-surface px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-medium text-gray-800">No groups yet</p>
          <p className="mt-1 text-sm text-muted">
            Tap + to create your first group.
          </p>
        </div>
      ) : (
        <ul className="space-y-3 pb-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/room/${group.roomCode}`}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {group.members.length}{' '}
                    {group.members.length === 1 ? 'member' : 'members'}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tracking-widest text-primary">
                    Code {group.roomCode}
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Modal title="New Group" onClose={() => !busy && setOpen(false)}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Group name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Friday Crew"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Your name (host)
              </span>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Alex"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Friends (comma-separated, optional)
              </span>
              <input
                type="text"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="Jordan, Sam"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              />
            </label>

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create Group'}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
