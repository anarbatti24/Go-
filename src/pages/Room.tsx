/**
 * Event room (`/room/:code`) — Kahoot-style hangout decisions
 *
 * Vision:
 *   1) Lobby — share code, wait for friends, add/remove your own roams, host sets timer
 *   2) Voting — event host starts; everyone has a countdown to pick
 *   3) Tie — full-screen drama, then automatic re-vote among tied places
 *   4) Results — winner revealed; any member can plan the next hangout
 *      (they become host for that round — host is fluid per event)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Dices,
  Link2,
  MapPin,
  Plus,
  Timer,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  addSuggestion,
  castRoomVote,
  fetchRoom,
  revealRoomWinner,
  removeSuggestion,
  startNewEvent,
  startVoting,
  updateRoomSettings,
  type RoomView,
} from '../api/rooms'
import { DramaticMoment } from '../components/DramaticMoment'
import { Modal } from '../components/Modal'
import { WinnerReveal } from '../components/WinnerReveal'
import { useStore } from '../store/useStore'
import { getRoomMemberId } from '../utils/session'
import { priceLabel } from '../utils/price'
import type { Place } from '../types'

const POLL_MS = 1000
const TIMER_PRESETS = [15, 30, 45, 60] as const

export function Room() {
  const { code = '' } = useParams<{ code: string }>()
  const places = useStore((s) => s.places)
  const getSavedPlaces = useStore((s) => s.getSavedPlaces)
  const mergePlaces = useStore((s) => s.mergePlaces)
  const savedPlaces = getSavedPlaces()

  const [room, setRoom] = useState<RoomView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  /** Avoid replaying the celebration while polling the same result. */
  const [celebratedKey, setCelebratedKey] = useState<string | null>(null)
  /** Clock skew: localNow ≈ serverNow + skewMs */
  const [skewMs, setSkewMs] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const memberId = getRoomMemberId(code)
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${code}`
      : `/join/${code}`

  const refresh = useCallback(async () => {
    if (!/^\d{4}$/.test(code)) return
    try {
      const next = await fetchRoom(code)
      const snapshots = next.suggestions
        .map((s) => s.place)
        .filter((p): p is Place => Boolean(p))
      if (snapshots.length > 0) mergePlaces(snapshots)
      setRoom(next)
      setSkewMs(Date.now() - next.serverNow)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load room')
    }
  }, [code, mergePlaces])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  // Smooth local countdown tick while voting, tie drama, or system-picking
  useEffect(() => {
    if (
      room?.phase !== 'voting' &&
      room?.phase !== 'picking' &&
      room?.phase !== 'tie'
    ) {
      return
    }
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [room?.phase])

  const me = useMemo(
    () => room?.members.find((m) => m.id === memberId) ?? null,
    [room, memberId],
  )

  const myVote = memberId && room ? (room.votes[memberId] ?? null) : null

  const secondsLeft = useMemo(() => {
    if (!room?.votingEndsAt || room.phase !== 'voting') return 0
    const serverAlignedNow = now - skewMs
    return Math.max(0, Math.ceil((room.votingEndsAt - serverAlignedNow) / 1000))
  }, [room, now, skewMs])

  const pickingSecondsLeft = useMemo(() => {
    if (!room?.pickingEndsAt || room.phase !== 'picking') return 0
    const serverAlignedNow = now - skewMs
    return Math.max(0, Math.ceil((room.pickingEndsAt - serverAlignedNow) / 1000))
  }, [room, now, skewMs])

  const tieSecondsLeft = useMemo(() => {
    if (!room?.tieEndsAt || room.phase !== 'tie') return 0
    const serverAlignedNow = now - skewMs
    return Math.max(0, Math.ceil((room.tieEndsAt - serverAlignedNow) / 1000))
  }, [room, now, skewMs])

  const eligibleSet = useMemo(() => {
    if (!room?.eligiblePlaceIds || room.eligiblePlaceIds.length === 0) {
      return null
    }
    return new Set(room.eligiblePlaceIds)
  }, [room])

  const suggestionCards = useMemo(() => {
    if (!room) return []
    return room.suggestions
      .map((suggestion) => {
        const place =
          suggestion.place ??
          places.find((p) => p.id === suggestion.placeId) ??
          null
        if (!place) return null
        // Drop eliminated options so runoff / picking stay short to scroll.
        if (eligibleSet && !eligibleSet.has(place.id)) return null
        return { suggestion, place }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
  }, [room, places, eligibleSet])

  const tiedNames = useMemo(() => {
    if (!room?.eligiblePlaceIds?.length) return []
    return room.eligiblePlaceIds.map((id) => {
      const fromSuggestion = room.suggestions.find((s) => s.placeId === id)
      return (
        fromSuggestion?.place?.name ??
        places.find((p) => p.id === id)?.name ??
        'a place'
      )
    })
  }, [room, places])

  const availableToAdd = useMemo(() => {
    if (!room) return []
    const used = new Set(room.suggestions.map((s) => s.placeId))
    return savedPlaces.filter((p) => !used.has(p.id))
  }, [room, savedPlaces])

  const votedCount = room ? Object.keys(room.votes).length : 0

  if (!/^\d{4}$/.test(code)) {
    return <Navigate to="/groups" replace />
  }

  if (!memberId) {
    return <Navigate to={`/join/${code}`} replace />
  }

  const flashCopied = (kind: 'code' | 'link') => {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1600)
  }

  const copyText = async (text: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text)
      flashCopied(kind)
    } catch {
      setError('Could not copy — select the text manually')
    }
  }

  const handleVote = async (placeId: string) => {
    if (!room || !memberId || room.phase !== 'voting' || busy) return
    if (eligibleSet && !eligibleSet.has(placeId)) return
    setBusy(true)
    try {
      const nextPlace = myVote === placeId ? null : placeId
      const next = await castRoomVote(code, memberId, nextPlace)
      setRoom(next)
      setSkewMs(Date.now() - next.serverNow)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed')
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (place: Place) => {
    if (!memberId || busy) return
    setBusy(true)
    try {
      const next = await addSuggestion(code, memberId, place.id, place)
      const snapshots = next.suggestions
        .map((s) => s.place)
        .filter((p): p is Place => Boolean(p))
      if (snapshots.length > 0) mergePlaces(snapshots)
      setRoom(next)
      setAddOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add place')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (placeId: string) => {
    if (!memberId || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await removeSuggestion(code, memberId, placeId)
      setRoom(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove place')
    } finally {
      setBusy(false)
    }
  }

  const handleSetDuration = async (seconds: number) => {
    if (!memberId || busy || !me?.isHost) return
    setBusy(true)
    try {
      const next = await updateRoomSettings(code, memberId, seconds)
      setRoom(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update timer')
    } finally {
      setBusy(false)
    }
  }

  const handleStart = async () => {
    if (!memberId || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await startVoting(code, memberId)
      setRoom(next)
      setSkewMs(Date.now() - next.serverNow)
      setNow(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start voting')
    } finally {
      setBusy(false)
    }
  }

  const handleEndEarly = async () => {
    if (!memberId || busy) return
    setBusy(true)
    try {
      const next = await revealRoomWinner(code, memberId)
      setRoom(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end voting')
    } finally {
      setBusy(false)
    }
  }

  const handleNewEvent = async () => {
    if (!memberId || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await startNewEvent(code, memberId)
      setRoom(next)
      setSkewMs(Date.now() - next.serverNow)
      setNow(Date.now())
      setCelebratedKey(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start a new event',
      )
    } finally {
      setBusy(false)
    }
  }

  const dismissWinnerReveal = useCallback(() => {
    if (!room?.winnerId) return
    setCelebratedKey(`${room.code}:${room.winnerId}`)
  }, [room?.code, room?.winnerId])

  if (error && !room) {
    return (
      <div>
        <Link
          to="/groups"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Link>
        <div className="rounded-2xl bg-surface px-6 py-12 text-center shadow-sm ring-1 ring-black/5">
          <p className="font-medium text-gray-800">{error}</p>
          <p className="mt-1 text-sm text-muted">
            Codes only work while the Go! dev server is running.
          </p>
          <Link
            to="/join"
            className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Try another code
          </Link>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="py-16 text-center text-sm text-muted">Loading room…</div>
    )
  }

  const winner = room.winnerId
    ? room.suggestions.find((s) => s.placeId === room.winnerId)?.place ??
      places.find((p) => p.id === room.winnerId)
    : null
  const showTallies =
    room.phase === 'results' || room.phase === 'tie' || room.phase === 'picking'
  const canVote = room.phase === 'voting'
  const isTiebreaker = canVote && room.voteRound >= 2
  const timerUrgent = canVote && secondsLeft <= 5
  const showTieDrama = room.phase === 'tie'
  const showPickingDrama = room.phase === 'picking'
  const winnerKey =
    room.phase === 'results' && room.winnerId
      ? `${room.code}:${room.winnerId}`
      : null
  const showWinnerReveal = Boolean(
    winner && winnerKey && celebratedKey !== winnerKey,
  )

  return (
    <div>
      {showTieDrama ? (
        <DramaticMoment
          kind="tie"
          names={tiedNames}
          secondsLeft={tieSecondsLeft}
        />
      ) : null}
      {showPickingDrama ? (
        <DramaticMoment
          kind="picking"
          names={tiedNames}
          secondsLeft={pickingSecondsLeft}
        />
      ) : null}
      {showWinnerReveal && winner ? (
        <WinnerReveal
          place={winner}
          resolvedBy={room.resolvedBy}
          onDone={dismissWinnerReveal}
        />
      ) : null}

      <header className="mb-5">
        <Link
          to="/groups"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{room.groupName}</h1>
        <p className="mt-1 text-sm text-muted">
          {room.phase === 'lobby' &&
            (me?.isHost
              ? 'Waiting room — start when everyone is ready.'
              : `Waiting for ${room.members.find((m) => m.isHost)?.name ?? 'the host'} to start…`)}
          {room.phase === 'voting' &&
            (isTiebreaker
              ? 'Tiebreaker — pick among the tied places!'
              : 'Voting is live — pick a place!')}
          {room.phase === 'tie' && 'It’s a tie — re-vote starting automatically…'}
          {room.phase === 'picking' && 'Tied again — the system is choosing…'}
          {room.phase === 'results' && 'Voting is over.'}
        </p>
      </header>

      {/* Live voting timer */}
      {room.phase === 'voting' ? (
        <section
          className={[
            'mb-5 overflow-hidden rounded-2xl p-4 text-center shadow-sm ring-1 transition',
            timerUrgent
              ? 'bg-red-50 ring-red-200'
              : isTiebreaker
                ? 'bg-amber-50 ring-amber-200'
                : 'bg-surface ring-black/5',
          ].join(' ')}
        >
          <p
            className={[
              'text-xs font-semibold uppercase tracking-wider',
              timerUrgent
                ? 'text-red-600'
                : isTiebreaker
                  ? 'text-amber-800'
                  : 'text-primary',
            ].join(' ')}
          >
            {isTiebreaker ? 'Tiebreaker' : 'Time left'}
          </p>
          <p
            className={[
              'mt-1 font-mono text-5xl font-bold tabular-nums',
              timerUrgent ? 'text-red-600' : 'text-gray-900',
            ].join(' ')}
          >
            {secondsLeft}
          </p>
          <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
            <div
              className={[
                'h-full rounded-full transition-[width] duration-200',
                timerUrgent
                  ? 'bg-red-500'
                  : isTiebreaker
                    ? 'bg-amber-500'
                    : 'bg-primary',
              ].join(' ')}
              style={{
                width: `${Math.min(
                  100,
                  (secondsLeft / Math.max(1, room.voteDurationSeconds)) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {votedCount}/{room.members.length} voted
            {myVote ? ' · You’re in!' : ' · Tap a place below'}
            {isTiebreaker
              ? ' · Still tied after this? We’ll roll for it.'
              : ''}
          </p>
        </section>
      ) : null}

      {/* Lobby: invite + timer settings */}
      {room.phase === 'lobby' ? (
        <>
          <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Invite friends
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Room code</p>
                <p className="font-mono text-3xl font-bold tracking-[0.35em] text-gray-900">
                  {room.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyText(room.code, 'code')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200"
              >
                {copied === 'code' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === 'code' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void copyText(shareUrl, 'link')}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              {copied === 'link' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Link2 className="h-4 w-4 text-primary" />
              )}
              {copied === 'link' ? 'Link copied' : 'Copy invite link'}
            </button>
            <p className="mt-2 break-all text-xs text-muted">{shareUrl}</p>
          </section>

          {me?.isHost ? (
            <section className="mb-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Timer className="h-4 w-4 text-primary" />
                Voting timer
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TIMER_PRESETS.map((seconds) => {
                  const selected = room.voteDurationSeconds === seconds
                  return (
                    <button
                      key={seconds}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSetDuration(seconds)}
                      className={[
                        'rounded-xl py-2.5 text-sm font-semibold transition',
                        selected
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
                      ].join(' ')}
                    >
                      {seconds}s
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                Everyone gets this long to vote once you start.
              </p>
            </section>
          ) : (
            <section className="mb-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
              <Clock className="h-4 w-4 shrink-0" />
              Host set the timer to {room.voteDurationSeconds}s — hang tight.
            </section>
          )}
        </>
      ) : null}

      {/* Members */}
      <section className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-primary" />
          {room.phase === 'lobby'
            ? `Waiting room (${room.members.length})`
            : `Players (${room.members.length})`}
        </div>
        <ul className="flex flex-wrap gap-2">
          {room.members.map((member) => {
            const hasVoted = Boolean(room.votes[member.id])
            return (
              <li
                key={member.id}
                className={[
                  'rounded-full px-3 py-1 text-sm text-gray-800 ring-1',
                  room.phase === 'voting' && hasVoted
                    ? 'bg-green-50 ring-green-200'
                    : 'bg-white ring-black/5',
                ].join(' ')}
              >
                {member.name}
                {member.isHost ? (
                  <span className="ml-1 text-xs font-medium text-primary">
                    host
                  </span>
                ) : null}
                {member.id === memberId ? (
                  <span className="ml-1 text-xs text-muted">(you)</span>
                ) : null}
                {room.phase === 'voting' && hasVoted ? (
                  <span className="ml-1 text-xs font-medium text-green-700">
                    ✓
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Suggestions */}
      <section className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {room.phase === 'results'
              ? 'Results'
              : room.phase === 'tie'
                ? 'Tied places'
                : room.phase === 'picking'
                  ? 'Still tied'
                  : isTiebreaker
                    ? 'Tiebreaker picks'
                    : 'Suggestions'}
          </h2>
          <p className="text-sm text-muted">
            {room.phase === 'lobby' &&
              'Add places before the host starts — tap × to undo yours.'}
            {room.phase === 'voting' &&
              (isTiebreaker
                ? 'Only the tied places are left — tap one.'
                : 'Tap one place to cast your vote.')}
            {room.phase === 'tie' && 'Re-vote launching automatically…'}
            {room.phase === 'picking' && 'Hang tight — fate is rolling.'}
            {room.phase === 'results' && 'Here’s how everyone voted.'}
          </p>
        </div>
        {room.phase === 'lobby' ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        ) : null}
      </section>

      {suggestionCards.length === 0 ? (
        <div className="rounded-2xl bg-surface px-6 py-10 text-center shadow-sm ring-1 ring-black/5">
          <p className="font-medium text-gray-800">No places yet</p>
          <p className="mt-1 text-sm text-muted">
            Add at least 2 roams so the host can start voting.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Add from My Roams
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {suggestionCards.map(({ place, suggestion }) => {
            const isSelected = myVote === place.id
            const isWinner = room.winnerId === place.id
            const tally = room.tallies[place.id] ?? 0
            const canRemoveOwn =
              room.phase === 'lobby' &&
              Boolean(memberId) &&
              suggestion.addedById === memberId
            return (
              <div
                key={place.id}
                className={[
                  'relative overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-2 transition',
                  isWinner
                    ? 'ring-green-500'
                    : room.phase === 'tie' || room.phase === 'picking'
                      ? 'ring-amber-400'
                      : isSelected
                        ? 'ring-primary'
                        : 'ring-transparent',
                  canVote ? 'hover:shadow-md' : '',
                  room.phase === 'results' && !isWinner ? 'opacity-70' : '',
                ].join(' ')}
              >
                {canRemoveOwn ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRemove(place.id)}
                    className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-50"
                    aria-label={`Remove ${place.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleVote(place.id)}
                  disabled={!canVote || busy}
                  className={[
                    'w-full text-left',
                    !canVote && room.phase !== 'results'
                      ? 'cursor-default'
                      : '',
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
                        {room.resolvedBy === 'random' ? (
                          <Dices className="h-3.5 w-3.5" />
                        ) : (
                          <Trophy className="h-3.5 w-3.5" />
                        )}
                        {room.resolvedBy === 'random' ? 'Lucky pick' : 'Winner'}
                      </span>
                    ) : null}
                    {room.phase === 'tie' ? (
                      <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">
                        Tied
                      </span>
                    ) : null}
                    {room.phase === 'picking' ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
                        <Dices className="h-3.5 w-3.5" />
                        In the roll
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">
                        {place.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {priceLabel(place.price)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Added by {suggestion.addedByName}
                        {suggestion.addedById === memberId ? ' (you)' : ''}
                      </p>
                    </div>
                    {showTallies ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-800">
                        {tally} {tally === 1 ? 'vote' : 'votes'}
                      </span>
                    ) : isSelected ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                        Your pick
                      </span>
                    ) : null}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Host controls */}
      {me?.isHost && room.phase === 'lobby' ? (
        <button
          type="button"
          disabled={busy || suggestionCards.length < 2}
          onClick={() => void handleStart()}
          className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {suggestionCards.length < 2
            ? `Add ${2 - suggestionCards.length} more to start`
            : `Start Voting (${room.voteDurationSeconds}s)`}
        </button>
      ) : null}

      {me?.isHost && room.phase === 'voting' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleEndEarly()}
          className="mt-6 w-full rounded-xl border border-border bg-white py-3.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
        >
          End voting now
        </button>
      ) : null}

      {winner ? (
        <div className="mt-6 rounded-2xl border-2 border-green-500 bg-green-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
            {room.resolvedBy === 'random'
              ? 'Decided by chance'
              : "Tonight's pick"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">{winner.name}</h2>
          {room.resolvedBy === 'random' ? (
            <p className="mt-1 text-sm text-green-800/80">
              Still tied after the re-vote — we rolled among the tied options.
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            {winner.description}
          </p>
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

      {room.phase === 'results' ? (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={busy || !memberId}
            onClick={() => void handleNewEvent()}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-dark disabled:opacity-50"
          >
            Plan another hangout
          </button>
          <p className="text-center text-xs text-muted">
            Same group & code — you’ll become host for the next round and
            everyone can add fresh places.
          </p>
        </div>
      ) : null}

      {addOpen ? (
        <Modal title="Add from My Roams" onClose={() => setAddOpen(false)}>
          {availableToAdd.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted">
                {savedPlaces.length === 0
                  ? 'Save places from Feed first, then come back.'
                  : 'All of your saved places are already in this room.'}
              </p>
              {savedPlaces.length === 0 ? (
                <Link
                  to="/"
                  className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Go to Feed
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {availableToAdd.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAdd(place)}
                    className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-2.5 text-left transition hover:bg-gray-100"
                  >
                    <img
                      src={place.image}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {place.name}
                      </p>
                      <p className="text-xs text-muted">
                        {priceLabel(place.price)}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
