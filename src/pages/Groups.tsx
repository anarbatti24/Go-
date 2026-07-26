/**
 * Groups (`/groups`) — create crews and start planning
 *
 * Vision: Go! isn't only solo discovery. Groups turn saved places into a shared
 * decision. Tap a group → Event Setup (shortlist) → Voting (pick a winner).
 *
 * Today members are free-text names (comma-separated). Later you might swap that
 * for contacts / auth users; the Group model already stores `members: string[]`.
 */

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { Modal } from '../components/Modal'
import { useStore } from '../store/useStore'

/** List of groups + floating create affordance. */
export function Groups() {
  const groups = useStore((s) => s.groups)
  const addGroup = useStore((s) => s.addGroup)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  /** Raw comma-separated member input before we split it for the store */
  const [members, setMembers] = useState('')

  /**
   * Persist a new group, then reset the form so the next create starts clean.
   * Requires a non-empty name; members are optional.
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addGroup(
      name,
      members
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    )
    setName('')
    setMembers('')
    setOpen(false)
  }

  return (
    <div className="relative min-h-full">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <p className="mt-1 text-sm text-muted">Plan hangouts and vote on where to go.</p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-surface px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-medium text-gray-800">No groups yet</p>
          <p className="mt-1 text-sm text-muted">Tap + to create your first group.</p>
        </div>
      ) : (
        <ul className="space-y-3 pb-20">
          {groups.map((group) => (
            <li key={group.id}>
              {/* Enter the planning stack for this crew */}
              <Link
                to={`/event/${group.id}`}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {group.members.length}{' '}
                    {group.members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">Set up →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Sticky FAB stays reachable while scrolling the list */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sticky bottom-24 z-30 ml-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary-dark"
        aria-label="Create group"
      >
        <Plus className="h-7 w-7" />
      </button>

      {open ? (
        <Modal title="New Group" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Group name</span>
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
                Members (comma-separated)
              </span>
              <input
                type="text"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="Alex, Jordan, Sam"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Save Group
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
