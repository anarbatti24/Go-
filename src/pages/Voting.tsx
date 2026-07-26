/**
 * Voting (`/vote`) — decide where the group goes
 *
 * Vision: the payoff of Go!'s loop. Friends (or solo prototyping) tap a card to
 * cast a vote, see live tallies, then hit "Reveal Winner" for a clear green
 * highlight + detail panel — "tonight's pick."
 *
 * Voting state lives in Zustand (`votingPlaceIds`, `votes`, `selectedVoteId`,
 * `winnerId`) so refresh of this screen alone still works mid-session. If you
 * land here with an empty session, we bounce you back to Groups.
 *
 * Current model is single-voter / single-choice for demo purposes. Multi-user
 * realtime votes would plug into the same UI with a backend later.
 */

import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Trophy } from 'lucide-react'
import { useStore } from '../store/useStore'
import { priceLabel } from '../utils/price'

/** Interactive vote cards + reveal / winner summary. */
export function Voting() {
  const places = useStore((s) => s.places)
  const votingPlaceIds = useStore((s) => s.votingPlaceIds)
  const votes = useStore((s) => s.votes)
  const selectedVoteId = useStore((s) => s.selectedVoteId)
  const winnerId = useStore((s) => s.winnerId)
  const castVote = useStore((s) => s.castVote)
  const revealWinner = useStore((s) => s.revealWinner)

  // Guard: no shortlist means the user skipped Event Setup
  if (votingPlaceIds.length === 0) {
    return <Navigate to="/groups" replace />
  }

  /** Resolve ids → Place objects, dropping any stale ids just in case. */
  const votingPlaces = votingPlaceIds
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const winner = winnerId ? places.find((p) => p.id === winnerId) : null

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
        <h1 className="text-2xl font-bold text-gray-900">Voting</h1>
        <p className="mt-1 text-sm text-muted">Tap a place to cast your vote.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {votingPlaces.map((place) => {
          const isSelected = selectedVoteId === place.id
          const isWinner = winnerId === place.id
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => castVote(place.id)}
              // Lock cards once a winner is revealed
              disabled={Boolean(winnerId)}
              className={[
                'overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-2 transition',
                isWinner
                  ? 'ring-green-500'
                  : isSelected
                    ? 'ring-primary'
                    : 'ring-transparent ring-offset-0 hover:shadow-md',
                winnerId && !isWinner ? 'opacity-70' : '',
              ].join(' ')}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                <img
                  src={place.image}
                  alt={place.name}
                  className="h-full w-full object-cover"
                />
                {isWinner ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-xs font-semibold text-white">
                    <Trophy className="h-3.5 w-3.5" />
                    Winner
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-gray-900">{place.name}</h3>
                  <p className="mt-0.5 text-sm text-muted">{priceLabel(place.price)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-800">
                  {votes[place.id] ?? 0} {votes[place.id] === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Pre-reveal CTA vs post-reveal celebration panel */}
      {!winnerId ? (
        <button
          type="button"
          onClick={revealWinner}
          className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-dark"
        >
          Reveal Winner
        </button>
      ) : winner ? (
        <div className="mt-6 rounded-2xl border-2 border-green-500 bg-green-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
            Tonight&apos;s pick
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">{winner.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{winner.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            <span>{priceLabel(winner.price)}</span>
            <span>{winner.distance}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-green-600" />
              {winner.location}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
