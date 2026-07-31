/**
 * Room REST handlers — shared by Vite middleware and Vercel `/api/rooms`.
 *
 * All mutations go through store.update() (versioned CAS) so concurrent
 * suggestion adds from friends merge instead of overwriting.
 */

import { getRoomStore } from './roomStore.js'
import type { ApiResult, EventMember, EventRoom, EventSuggestion, Place } from './types.js'
import { PICKING_DURATION_MS, TIE_PAUSE_MS } from './types.js'

export const MAX_SUGGESTIONS = 8
export const MIN_VOTE_SECONDS = 10
export const MAX_VOTE_SECONDS = 120
export const DEFAULT_VOTE_SECONDS = 30

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function isPlaceSnapshot(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return typeof p.id === 'string' && typeof p.name === 'string'
}

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_VOTE_SECONDS
  return Math.min(
    MAX_VOTE_SECONDS,
    Math.max(MIN_VOTE_SECONDS, Math.round(seconds)),
  )
}

/** Backfill fields added for tiebreakers (rooms already in Redis). */
function ensureTieFields(room: EventRoom): void {
  if (typeof room.voteRound !== 'number' || room.voteRound < 1) {
    room.voteRound = 1
  }
  if (room.eligiblePlaceIds === undefined) {
    room.eligiblePlaceIds = null
  }
  if (room.resolvedBy === undefined) {
    room.resolvedBy = null
  }
  if (room.pickingEndsAt === undefined) {
    room.pickingEndsAt = null
  }
  if (room.tieEndsAt === undefined) {
    room.tieEndsAt = null
  }
}

function eligibleIds(room: EventRoom): string[] {
  if (room.eligiblePlaceIds && room.eligiblePlaceIds.length > 0) {
    const allowed = new Set(room.eligiblePlaceIds)
    return room.suggestions
      .map((s) => s.placeId)
      .filter((id) => allowed.has(id))
  }
  return room.suggestions.map((s) => s.placeId)
}

function tallyVotes(room: EventRoom): Record<string, number> {
  const tallies: Record<string, number> = {}
  for (const suggestion of room.suggestions) {
    tallies[suggestion.placeId] = 0
  }
  const allowed = new Set(eligibleIds(room))
  for (const placeId of Object.values(room.votes)) {
    if (placeId in tallies && allowed.has(placeId)) tallies[placeId] += 1
  }
  return tallies
}

function leadersFromTallies(
  room: EventRoom,
  tallies: Record<string, number>,
): string[] {
  const ids = eligibleIds(room)
  if (ids.length === 0) return []
  let maxVotes = -1
  for (const id of ids) {
    const count = tallies[id] ?? 0
    if (count > maxVotes) maxVotes = count
  }
  return ids.filter((id) => (tallies[id] ?? 0) === maxVotes)
}

function pickRandom(ids: string[]): string {
  const index = Math.floor(Math.random() * ids.length)
  return ids[index]!
}

function finishWithWinner(
  room: EventRoom,
  winnerId: string,
  resolvedBy: 'votes' | 'random',
): void {
  room.phase = 'results'
  room.winnerId = winnerId
  room.resolvedBy = resolvedBy
  room.votingEndsAt = Date.now()
  room.pickingEndsAt = null
  room.tieEndsAt = null
}

/** After the dramatic countdown, roll among the tied places. */
function resolvePicking(room: EventRoom): void {
  ensureTieFields(room)
  const pool = eligibleIds(room)
  if (pool.length === 0) {
    room.phase = 'results'
    room.winnerId = null
    room.resolvedBy = null
    room.pickingEndsAt = null
    room.tieEndsAt = null
    return
  }
  finishWithWinner(room, pickRandom(pool), 'random')
}

/** Auto-start the runoff after the full-screen tie beat. */
function beginRevote(room: EventRoom): void {
  ensureTieFields(room)
  const tied = room.eligiblePlaceIds
  if (!tied || tied.length < 2) {
    // Degenerate tie — nothing to re-vote; fall through to results if possible.
    if (tied && tied.length === 1) {
      finishWithWinner(room, tied[0]!, 'votes')
      return
    }
    room.phase = 'results'
    room.winnerId = null
    room.resolvedBy = null
    room.tieEndsAt = null
    room.pickingEndsAt = null
    return
  }
  room.phase = 'voting'
  room.votes = {}
  room.winnerId = null
  room.resolvedBy = null
  room.voteRound = 2
  room.pickingEndsAt = null
  room.tieEndsAt = null
  room.votingEndsAt = Date.now() + room.voteDurationSeconds * 1000
}

/**
 * Close an open vote: sole leader → results; first-round tie → pause;
 * second-round (or later) tie → dramatic system-pick countdown.
 */
function resolveVoting(room: EventRoom): void {
  ensureTieFields(room)
  if (room.suggestions.length === 0) {
    room.phase = 'results'
    room.winnerId = null
    room.resolvedBy = null
    room.votingEndsAt = Date.now()
    room.pickingEndsAt = null
    room.tieEndsAt = null
    return
  }

  const tallies = tallyVotes(room)
  const leaders = leadersFromTallies(room, tallies)

  if (leaders.length <= 1) {
    finishWithWinner(
      room,
      leaders[0] ?? room.suggestions[0]!.placeId,
      'votes',
    )
    return
  }

  // First-round tie — dramatic pause, then automatic re-vote among leaders.
  if (room.voteRound < 2) {
    room.phase = 'tie'
    room.winnerId = null
    room.resolvedBy = null
    room.eligiblePlaceIds = leaders
    room.votingEndsAt = null
    room.pickingEndsAt = null
    room.tieEndsAt = Date.now() + TIE_PAUSE_MS
    return
  }

  // Second-round tie — countdown, then RNG.
  room.phase = 'picking'
  room.winnerId = null
  room.resolvedBy = null
  room.eligiblePlaceIds = leaders
  room.votingEndsAt = Date.now()
  room.pickingEndsAt = Date.now() + PICKING_DURATION_MS
  room.tieEndsAt = null
}

function finalizeIfExpired(room: EventRoom): boolean {
  ensureTieFields(room)
  if (
    room.phase === 'voting' &&
    room.votingEndsAt != null &&
    Date.now() >= room.votingEndsAt
  ) {
    resolveVoting(room)
    return true
  }
  if (
    room.phase === 'tie' &&
    room.tieEndsAt != null &&
    Date.now() >= room.tieEndsAt
  ) {
    beginRevote(room)
    return true
  }
  if (
    room.phase === 'picking' &&
    room.pickingEndsAt != null &&
    Date.now() >= room.pickingEndsAt
  ) {
    resolvePicking(room)
    return true
  }
  return false
}

function roomPayload(room: EventRoom) {
  ensureTieFields(room)
  finalizeIfExpired(room)
  return {
    ...room,
    tallies: tallyVotes(room),
    serverNow: Date.now(),
  }
}

function requireHost(room: EventRoom, memberId?: string): EventMember | null {
  const member = room.members.find((m) => m.id === memberId)
  if (!member?.isHost) return null
  return member
}

async function generateCode(): Promise<string> {
  const store = getRoomStore()
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    if (!(await store.has(code))) return code
  }
  throw new Error('Could not allocate a room code')
}

async function loadRoom(code: string): Promise<EventRoom | null> {
  const store = getRoomStore()
  const room = await store.get(code)
  if (!room) return null
  ensureTieFields(room)
  if (finalizeIfExpired(room)) {
    try {
      return (
        (await store.update(code, (draft) => {
          ensureTieFields(draft)
          const now = Date.now()
          if (
            draft.phase === 'voting' &&
            draft.votingEndsAt != null &&
            now >= draft.votingEndsAt
          ) {
            resolveVoting(draft)
          } else if (
            draft.phase === 'tie' &&
            draft.tieEndsAt != null &&
            now >= draft.tieEndsAt
          ) {
            beginRevote(draft)
          } else if (
            draft.phase === 'picking' &&
            draft.pickingEndsAt != null &&
            now >= draft.pickingEndsAt
          ) {
            resolvePicking(draft)
          }
        })) ?? room
      )
    } catch {
      return room
    }
  }
  return room
}

/**
 * Apply a mutation with CAS retries. Mutator may throw HttpError to abort.
 */
async function mutateRoom(
  code: string,
  mutator: (room: EventRoom) => void,
): Promise<EventRoom> {
  const store = getRoomStore()
  try {
    const updated = await store.update(code, mutator)
    if (!updated) throw new HttpError(404, 'Room not found')
    return updated
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw err
  }
}

/**
 * Route a rooms API request.
 * `path` is the pathname only, e.g. `/api/rooms` or `/api/rooms/1234/join`.
 */
export async function handleRoomsRequest(
  method: string,
  path: string,
  body: unknown = {},
): Promise<ApiResult> {
  const verb = method.toUpperCase()
  const data = (body ?? {}) as Record<string, unknown>
  const store = getRoomStore()

  try {
    if (path === '/api/rooms' && verb === 'POST') {
      const hostName =
        (typeof data.hostName === 'string' && data.hostName.trim()) || 'Host'
      const hostId = newId()
      const code = await generateCode()
      const placeIds = Array.isArray(data.placeIds)
        ? data.placeIds
            .filter((id): id is string => typeof id === 'string')
            .slice(0, MAX_SUGGESTIONS)
        : []

      const host: EventMember = { id: hostId, name: hostName, isHost: true }
      const suggestions: EventSuggestion[] = placeIds.map((placeId) => ({
        placeId,
        addedById: hostId,
        addedByName: hostName,
      }))

      const room: EventRoom = {
        code,
        groupId:
          (typeof data.groupId === 'string' && data.groupId.trim()) || 'solo',
        groupName:
          (typeof data.groupName === 'string' && data.groupName.trim()) ||
          'Hangout',
        hostId,
        members: [host],
        suggestions,
        votes: {},
        winnerId: null,
        phase: 'lobby',
        voteDurationSeconds: clampDuration(
          typeof data.voteDurationSeconds === 'number'
            ? data.voteDurationSeconds
            : DEFAULT_VOTE_SECONDS,
        ),
        votingEndsAt: null,
        voteRound: 1,
        eligiblePlaceIds: null,
        resolvedBy: null,
        pickingEndsAt: null,
        tieEndsAt: null,
        createdAt: Date.now(),
        version: 0,
      }

      await store.set(code, room)
      return {
        status: 201,
        body: {
          room: roomPayload(room),
          memberId: hostId,
          store: store.backend,
        },
      }
    }

    const getMatch = path.match(/^\/api\/rooms\/(\d{4})$/)
    if (getMatch && verb === 'GET') {
      const room = await loadRoom(getMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const joinMatch = path.match(/^\/api\/rooms\/(\d{4})\/join$/)
    if (joinMatch && verb === 'POST') {
      const name = typeof data.name === 'string' ? data.name.trim() : ''
      if (!name) return { status: 400, body: { error: 'Name is required' } }

      let memberId = ''
      const room = await mutateRoom(joinMatch[1]!, (draft) => {
        const existing = draft.members.find(
          (m) => m.name.toLowerCase() === name.toLowerCase(),
        )
        if (existing) {
          memberId = existing.id
          return
        }
        if (draft.phase !== 'lobby' && draft.phase !== 'results') {
          throw new HttpError(
            400,
            'Voting is in progress — wait for this round to finish',
          )
        }
        const member: EventMember = {
          id: newId(),
          name,
          isHost: false,
        }
        draft.members.push(member)
        memberId = member.id
      })

      return {
        status: 200,
        body: { room: roomPayload(room), memberId },
      }
    }

    const settingsMatch = path.match(/^\/api\/rooms\/(\d{4})\/settings$/)
    if (settingsMatch && verb === 'POST') {
      const room = await mutateRoom(settingsMatch[1]!, (draft) => {
        if (draft.phase !== 'lobby') {
          throw new HttpError(400, 'Can only change settings in the lobby')
        }
        if (
          !requireHost(
            draft,
            typeof data.memberId === 'string' ? data.memberId : undefined,
          )
        ) {
          throw new HttpError(403, 'Only the host can change settings')
        }
        if (typeof data.voteDurationSeconds === 'number') {
          draft.voteDurationSeconds = clampDuration(data.voteDurationSeconds)
        }
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const startMatch = path.match(/^\/api\/rooms\/(\d{4})\/start$/)
    if (startMatch && verb === 'POST') {
      const room = await mutateRoom(startMatch[1]!, (draft) => {
        if (draft.phase !== 'lobby') {
          throw new HttpError(400, 'Voting already started')
        }
        if (draft.suggestions.length < 2) {
          throw new HttpError(400, 'Add at least 2 places before starting')
        }
        if (
          !requireHost(
            draft,
            typeof data.memberId === 'string' ? data.memberId : undefined,
          )
        ) {
          throw new HttpError(403, 'Only the host can start voting')
        }
        if (typeof data.voteDurationSeconds === 'number') {
          draft.voteDurationSeconds = clampDuration(data.voteDurationSeconds)
        }
        draft.phase = 'voting'
        draft.votes = {}
        draft.winnerId = null
        draft.resolvedBy = null
        draft.voteRound = 1
        draft.eligiblePlaceIds = null
        draft.pickingEndsAt = null
        draft.tieEndsAt = null
        draft.votingEndsAt = Date.now() + draft.voteDurationSeconds * 1000
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const revoteMatch = path.match(/^\/api\/rooms\/(\d{4})\/revote$/)
    if (revoteMatch && verb === 'POST') {
      const room = await mutateRoom(revoteMatch[1]!, (draft) => {
        ensureTieFields(draft)
        if (draft.phase !== 'tie') {
          throw new HttpError(400, 'No tie to break — start a new vote first')
        }
        const tied = draft.eligiblePlaceIds
        if (!tied || tied.length < 2) {
          throw new HttpError(400, 'Need at least 2 tied places to re-vote')
        }
        if (typeof data.voteDurationSeconds === 'number') {
          draft.voteDurationSeconds = clampDuration(data.voteDurationSeconds)
        }
        // Kept for older clients; re-votes now auto-start after tieEndsAt.
        beginRevote(draft)
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const suggestMatch = path.match(/^\/api\/rooms\/(\d{4})\/suggestions$/)
    if (suggestMatch && verb === 'POST') {
      const placeId =
        typeof data.placeId === 'string' ? data.placeId.trim() : ''
      if (!placeId) {
        return { status: 400, body: { error: 'placeId is required' } }
      }

      const placeSnapshot = isPlaceSnapshot(data.place) ? data.place : undefined

      const room = await mutateRoom(suggestMatch[1]!, (draft) => {
        if (draft.phase !== 'lobby') {
          throw new HttpError(400, 'Places are locked once voting starts')
        }
        const member = draft.members.find(
          (m) =>
            m.id === (typeof data.memberId === 'string' ? data.memberId : ''),
        )
        if (!member) {
          throw new HttpError(403, 'Join the room first')
        }
        const existing = draft.suggestions.find((s) => s.placeId === placeId)
        if (existing) {
          // Backfill snapshot if an older client added id-only
          if (!existing.place && placeSnapshot) existing.place = placeSnapshot
          return
        }
        if (draft.suggestions.length >= MAX_SUGGESTIONS) {
          throw new HttpError(
            400,
            `Room is full (max ${MAX_SUGGESTIONS} places)`,
          )
        }
        draft.suggestions.push({
          placeId,
          addedById: member.id,
          addedByName: member.name,
          place: placeSnapshot,
        })
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    // Remove a roam you added (lobby only).
    if (suggestMatch && verb === 'DELETE') {
      const placeId =
        typeof data.placeId === 'string' ? data.placeId.trim() : ''
      if (!placeId) {
        return { status: 400, body: { error: 'placeId is required' } }
      }

      const room = await mutateRoom(suggestMatch[1]!, (draft) => {
        if (draft.phase !== 'lobby') {
          throw new HttpError(400, 'Places are locked once voting starts')
        }
        const member = draft.members.find(
          (m) =>
            m.id === (typeof data.memberId === 'string' ? data.memberId : ''),
        )
        if (!member) {
          throw new HttpError(403, 'Join the room first')
        }
        const index = draft.suggestions.findIndex((s) => s.placeId === placeId)
        if (index < 0) {
          throw new HttpError(404, 'That place is not in this room')
        }
        const suggestion = draft.suggestions[index]!
        if (suggestion.addedById !== member.id) {
          throw new HttpError(403, 'You can only remove spots you added')
        }
        draft.suggestions.splice(index, 1)
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const voteMatch = path.match(/^\/api\/rooms\/(\d{4})\/vote$/)
    if (voteMatch && verb === 'POST') {
      const placeId =
        data.placeId === null || data.placeId === undefined
          ? null
          : typeof data.placeId === 'string'
            ? data.placeId
            : null

      const room = await mutateRoom(voteMatch[1]!, (draft) => {
        finalizeIfExpired(draft)
        if (draft.phase !== 'voting') {
          throw new HttpError(400, 'Voting is not open')
        }
        const member = draft.members.find(
          (m) =>
            m.id === (typeof data.memberId === 'string' ? data.memberId : ''),
        )
        if (!member) {
          throw new HttpError(403, 'Join the room first')
        }

        if (!placeId) {
          delete draft.votes[member.id]
          return
        }

        if (!draft.suggestions.some((s) => s.placeId === placeId)) {
          throw new HttpError(400, 'Place is not in this room')
        }

        ensureTieFields(draft)
        const allowed = new Set(eligibleIds(draft))
        if (!allowed.has(placeId)) {
          throw new HttpError(400, 'That place is out of this round')
        }

        draft.votes[member.id] = placeId
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const revealMatch = path.match(/^\/api\/rooms\/(\d{4})\/reveal$/)
    if (revealMatch && verb === 'POST') {
      const room = await mutateRoom(revealMatch[1]!, (draft) => {
        ensureTieFields(draft)
        if (draft.suggestions.length === 0) {
          throw new HttpError(400, 'Add at least one place first')
        }
        if (
          !requireHost(
            draft,
            typeof data.memberId === 'string' ? data.memberId : undefined,
          )
        ) {
          throw new HttpError(403, 'Only the host can end voting early')
        }
        if (draft.phase !== 'voting') {
          throw new HttpError(400, 'Voting is not open')
        }
        resolveVoting(draft)
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const resetMatch = path.match(/^\/api\/rooms\/(\d{4})\/(reset|newevent)$/)
    if (resetMatch && verb === 'POST') {
      const room = await mutateRoom(resetMatch[1]!, (draft) => {
        ensureTieFields(draft)
        if (draft.phase !== 'results' && draft.phase !== 'tie') {
          throw new HttpError(
            400,
            'Finish the current vote before starting a new event',
          )
        }
        const member = draft.members.find(
          (m) =>
            m.id === (typeof data.memberId === 'string' ? data.memberId : ''),
        )
        if (!member) {
          throw new HttpError(403, 'Join the room first')
        }

        // Fluid host: whoever starts the next hangout runs this round.
        draft.hostId = member.id
        for (const m of draft.members) {
          m.isHost = m.id === member.id
        }

        // Fresh event by default; pass clearSuggestions:false to keep places.
        const clearSuggestions = data.clearSuggestions !== false

        draft.phase = 'lobby'
        draft.votes = {}
        draft.winnerId = null
        draft.resolvedBy = null
        draft.voteRound = 1
        draft.eligiblePlaceIds = null
        draft.votingEndsAt = null
        draft.pickingEndsAt = null
        draft.tieEndsAt = null
        if (clearSuggestions) {
          draft.suggestions = []
        }
      })
      return { status: 200, body: { room: roomPayload(room) } }
    }

    return { status: 404, body: { error: 'Not found' } }
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: error.status, body: { error: error.message } }
    }
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : 'Server error',
      },
    }
  }
}
