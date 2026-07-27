/**
 * Room REST handlers — shared by Vite middleware and Vercel `/api/rooms`.
 */

import { getRoomStore } from './roomStore.ts'
import type { ApiResult, EventMember, EventRoom, EventSuggestion } from './types.ts'

export const MAX_SUGGESTIONS = 8
export const MIN_VOTE_SECONDS = 10
export const MAX_VOTE_SECONDS = 120
export const DEFAULT_VOTE_SECONDS = 30

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

function tallyVotes(room: EventRoom): Record<string, number> {
  const tallies: Record<string, number> = {}
  for (const suggestion of room.suggestions) {
    tallies[suggestion.placeId] = 0
  }
  for (const placeId of Object.values(room.votes)) {
    if (placeId in tallies) tallies[placeId] += 1
  }
  return tallies
}

function pickWinner(room: EventRoom): string {
  const tallies = tallyVotes(room)
  let winnerId = room.suggestions[0]!.placeId
  let maxVotes = tallies[winnerId] ?? 0
  for (const suggestion of room.suggestions) {
    const count = tallies[suggestion.placeId] ?? 0
    if (count > maxVotes) {
      maxVotes = count
      winnerId = suggestion.placeId
    }
  }
  return winnerId
}

function finalizeIfExpired(room: EventRoom): boolean {
  if (
    room.phase === 'voting' &&
    room.votingEndsAt != null &&
    Date.now() >= room.votingEndsAt
  ) {
    room.phase = 'results'
    room.winnerId = room.suggestions.length > 0 ? pickWinner(room) : null
    return true
  }
  return false
}

function roomPayload(room: EventRoom) {
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
  if (finalizeIfExpired(room)) {
    await store.set(code, room)
  }
  return room
}

async function saveRoom(room: EventRoom): Promise<void> {
  await getRoomStore().set(room.code, room)
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
        ? data.placeIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_SUGGESTIONS)
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
        createdAt: Date.now(),
      }

      await saveRoom(room)
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
      const room = await loadRoom(joinMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }

      const name =
        typeof data.name === 'string' ? data.name.trim() : ''
      if (!name) return { status: 400, body: { error: 'Name is required' } }

      const existing = room.members.find(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      )
      if (existing) {
        return {
          status: 200,
          body: { room: roomPayload(room), memberId: existing.id },
        }
      }

      if (room.phase !== 'lobby') {
        return {
          status: 400,
          body: {
            error: 'Voting already started — ask the host for a new room',
          },
        }
      }

      const member: EventMember = {
        id: newId(),
        name,
        isHost: false,
      }
      room.members.push(member)
      await saveRoom(room)
      return {
        status: 200,
        body: { room: roomPayload(room), memberId: member.id },
      }
    }

    const settingsMatch = path.match(/^\/api\/rooms\/(\d{4})\/settings$/)
    if (settingsMatch && verb === 'POST') {
      const room = await loadRoom(settingsMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }
      if (room.phase !== 'lobby') {
        return {
          status: 400,
          body: { error: 'Can only change settings in the lobby' },
        }
      }
      if (!requireHost(room, typeof data.memberId === 'string' ? data.memberId : undefined)) {
        return { status: 403, body: { error: 'Only the host can change settings' } }
      }
      if (typeof data.voteDurationSeconds === 'number') {
        room.voteDurationSeconds = clampDuration(data.voteDurationSeconds)
      }
      await saveRoom(room)
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const startMatch = path.match(/^\/api\/rooms\/(\d{4})\/start$/)
    if (startMatch && verb === 'POST') {
      const room = await loadRoom(startMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }
      if (room.phase !== 'lobby') {
        return { status: 400, body: { error: 'Voting already started' } }
      }
      if (room.suggestions.length < 2) {
        return {
          status: 400,
          body: { error: 'Add at least 2 places before starting' },
        }
      }
      if (!requireHost(room, typeof data.memberId === 'string' ? data.memberId : undefined)) {
        return { status: 403, body: { error: 'Only the host can start voting' } }
      }
      if (typeof data.voteDurationSeconds === 'number') {
        room.voteDurationSeconds = clampDuration(data.voteDurationSeconds)
      }
      room.phase = 'voting'
      room.votes = {}
      room.winnerId = null
      room.votingEndsAt = Date.now() + room.voteDurationSeconds * 1000
      await saveRoom(room)
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const suggestMatch = path.match(/^\/api\/rooms\/(\d{4})\/suggestions$/)
    if (suggestMatch && verb === 'POST') {
      const room = await loadRoom(suggestMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }
      if (room.phase !== 'lobby') {
        return {
          status: 400,
          body: { error: 'Places are locked once voting starts' },
        }
      }
      const member = room.members.find(
        (m) => m.id === (typeof data.memberId === 'string' ? data.memberId : ''),
      )
      if (!member) {
        return { status: 403, body: { error: 'Join the room first' } }
      }
      const placeId =
        typeof data.placeId === 'string' ? data.placeId.trim() : ''
      if (!placeId) {
        return { status: 400, body: { error: 'placeId is required' } }
      }
      if (room.suggestions.some((s) => s.placeId === placeId)) {
        return { status: 200, body: { room: roomPayload(room) } }
      }
      if (room.suggestions.length >= MAX_SUGGESTIONS) {
        return {
          status: 400,
          body: { error: `Room is full (max ${MAX_SUGGESTIONS} places)` },
        }
      }
      room.suggestions.push({
        placeId,
        addedById: member.id,
        addedByName: member.name,
      })
      await saveRoom(room)
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const voteMatch = path.match(/^\/api\/rooms\/(\d{4})\/vote$/)
    if (voteMatch && verb === 'POST') {
      const room = await loadRoom(voteMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }
      if (room.phase !== 'voting') {
        return { status: 400, body: { error: 'Voting is not open' } }
      }
      const member = room.members.find(
        (m) => m.id === (typeof data.memberId === 'string' ? data.memberId : ''),
      )
      if (!member) {
        return { status: 403, body: { error: 'Join the room first' } }
      }

      const placeId =
        data.placeId === null || data.placeId === undefined
          ? null
          : typeof data.placeId === 'string'
            ? data.placeId
            : null

      if (!placeId) {
        delete room.votes[member.id]
        await saveRoom(room)
        return { status: 200, body: { room: roomPayload(room) } }
      }

      if (!room.suggestions.some((s) => s.placeId === placeId)) {
        return { status: 400, body: { error: 'Place is not in this room' } }
      }

      room.votes[member.id] = placeId
      await saveRoom(room)
      return { status: 200, body: { room: roomPayload(room) } }
    }

    const revealMatch = path.match(/^\/api\/rooms\/(\d{4})\/reveal$/)
    if (revealMatch && verb === 'POST') {
      const room = await loadRoom(revealMatch[1]!)
      if (!room) return { status: 404, body: { error: 'Room not found' } }
      if (room.suggestions.length === 0) {
        return {
          status: 400,
          body: { error: 'Add at least one place first' },
        }
      }
      if (!requireHost(room, typeof data.memberId === 'string' ? data.memberId : undefined)) {
        return {
          status: 403,
          body: { error: 'Only the host can end voting early' },
        }
      }
      if (room.phase === 'lobby') {
        return { status: 400, body: { error: 'Start voting first' } }
      }
      room.phase = 'results'
      room.votingEndsAt = Date.now()
      room.winnerId = pickWinner(room)
      await saveRoom(room)
      return { status: 200, body: { room: roomPayload(room) } }
    }

    return { status: 404, body: { error: 'Not found' } }
  } catch (error) {
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : 'Server error',
      },
    }
  }
}
