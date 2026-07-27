/**
 * Vite plugin — in-memory event rooms API
 *
 * Vision: Go! has no production backend yet, but multi-friend join/vote needs a
 * shared source of truth. During `npm run dev`, this plugin stores rooms in a
 * Map and exposes REST endpoints so phones on the same Wi‑Fi can join via code.
 *
 * Flow: lobby (wait + add places) → host starts → timed voting → auto results.
 * Rooms live only while the Vite process is running (restart clears them).
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const MAX_SUGGESTIONS = 8
const MIN_VOTE_SECONDS = 10
const MAX_VOTE_SECONDS = 120
const DEFAULT_VOTE_SECONDS = 30

type RoomPhase = 'lobby' | 'voting' | 'results'

interface EventMember {
  id: string
  name: string
  isHost: boolean
}

interface EventSuggestion {
  placeId: string
  addedById: string
  addedByName: string
}

interface EventRoom {
  code: string
  groupId: string
  groupName: string
  hostId: string
  members: EventMember[]
  suggestions: EventSuggestion[]
  votes: Record<string, string>
  winnerId: string | null
  phase: RoomPhase
  voteDurationSeconds: number
  votingEndsAt: number | null
  createdAt: number
}

const rooms = new Map<string, EventRoom>()

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function generateCode(): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    if (!rooms.has(code)) return code
  }
  throw new Error('Could not allocate a room code')
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

/** If the voting clock expired, lock votes and crown a winner. */
function finalizeIfExpired(room: EventRoom) {
  if (
    room.phase === 'voting' &&
    room.votingEndsAt != null &&
    Date.now() >= room.votingEndsAt
  ) {
    room.phase = 'results'
    room.winnerId =
      room.suggestions.length > 0 ? pickWinner(room) : null
  }
}

function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_VOTE_SECONDS
  return Math.min(
    MAX_VOTE_SECONDS,
    Math.max(MIN_VOTE_SECONDS, Math.round(seconds)),
  )
}

function roomPayload(room: EventRoom) {
  finalizeIfExpired(room)
  return {
    ...room,
    tallies: tallyVotes(room),
    /** Clients sync their countdown clocks against this. */
    serverNow: Date.now(),
  }
}

function requireHost(room: EventRoom, memberId?: string): EventMember | null {
  const member = room.members.find((m) => m.id === memberId)
  if (!member?.isHost) return null
  return member
}

export function roomsApiPlugin(): Plugin {
  return {
    name: 'go-rooms-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/rooms')) {
          next()
          return
        }

        try {
          const path = url.split('?')[0] ?? url
          const method = (req.method ?? 'GET').toUpperCase()

          if (path === '/api/rooms' && method === 'POST') {
            const body = (await readBody(req)) as {
              groupId?: string
              groupName?: string
              hostName?: string
              placeIds?: string[]
              voteDurationSeconds?: number
            }

            const hostName = body.hostName?.trim() || 'Host'
            const hostId = crypto.randomUUID()
            const code = generateCode()
            const placeIds = Array.isArray(body.placeIds)
              ? body.placeIds.filter(Boolean).slice(0, MAX_SUGGESTIONS)
              : []

            const host: EventMember = {
              id: hostId,
              name: hostName,
              isHost: true,
            }

            const suggestions: EventSuggestion[] = placeIds.map((placeId) => ({
              placeId,
              addedById: hostId,
              addedByName: hostName,
            }))

            const room: EventRoom = {
              code,
              groupId: body.groupId?.trim() || 'solo',
              groupName: body.groupName?.trim() || 'Hangout',
              hostId,
              members: [host],
              suggestions,
              votes: {},
              winnerId: null,
              phase: 'lobby',
              voteDurationSeconds: clampDuration(
                body.voteDurationSeconds ?? DEFAULT_VOTE_SECONDS,
              ),
              votingEndsAt: null,
              createdAt: Date.now(),
            }

            rooms.set(code, room)
            sendJson(res, 201, { room: roomPayload(room), memberId: hostId })
            return
          }

          const getMatch = path.match(/^\/api\/rooms\/(\d{4})$/)
          if (getMatch && method === 'GET') {
            const room = rooms.get(getMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            sendJson(res, 200, { room: roomPayload(room) })
            return
          }

          const joinMatch = path.match(/^\/api\/rooms\/(\d{4})\/join$/)
          if (joinMatch && method === 'POST') {
            const room = rooms.get(joinMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            finalizeIfExpired(room)

            const body = (await readBody(req)) as { name?: string }
            const name = body.name?.trim()
            if (!name) {
              sendJson(res, 400, { error: 'Name is required' })
              return
            }

            const existing = room.members.find(
              (m) => m.name.toLowerCase() === name.toLowerCase(),
            )
            if (existing) {
              sendJson(res, 200, {
                room: roomPayload(room),
                memberId: existing.id,
              })
              return
            }

            if (room.phase !== 'lobby') {
              sendJson(res, 400, {
                error: 'Voting already started — ask the host for a new room',
              })
              return
            }

            const member: EventMember = {
              id: crypto.randomUUID(),
              name,
              isHost: false,
            }
            room.members.push(member)
            sendJson(res, 200, { room: roomPayload(room), memberId: member.id })
            return
          }

          // Host updates lobby settings (vote timer length)
          const settingsMatch = path.match(/^\/api\/rooms\/(\d{4})\/settings$/)
          if (settingsMatch && method === 'POST') {
            const room = rooms.get(settingsMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            if (room.phase !== 'lobby') {
              sendJson(res, 400, { error: 'Can only change settings in the lobby' })
              return
            }

            const body = (await readBody(req)) as {
              memberId?: string
              voteDurationSeconds?: number
            }
            if (!requireHost(room, body.memberId)) {
              sendJson(res, 403, { error: 'Only the host can change settings' })
              return
            }

            if (body.voteDurationSeconds != null) {
              room.voteDurationSeconds = clampDuration(body.voteDurationSeconds)
            }
            sendJson(res, 200, { room: roomPayload(room) })
            return
          }

          // Host starts the timed voting round
          const startMatch = path.match(/^\/api\/rooms\/(\d{4})\/start$/)
          if (startMatch && method === 'POST') {
            const room = rooms.get(startMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            if (room.phase !== 'lobby') {
              sendJson(res, 400, { error: 'Voting already started' })
              return
            }
            if (room.suggestions.length < 2) {
              sendJson(res, 400, {
                error: 'Add at least 2 places before starting',
              })
              return
            }

            const body = (await readBody(req)) as {
              memberId?: string
              voteDurationSeconds?: number
            }
            if (!requireHost(room, body.memberId)) {
              sendJson(res, 403, { error: 'Only the host can start voting' })
              return
            }

            if (body.voteDurationSeconds != null) {
              room.voteDurationSeconds = clampDuration(body.voteDurationSeconds)
            }

            room.phase = 'voting'
            room.votes = {}
            room.winnerId = null
            room.votingEndsAt = Date.now() + room.voteDurationSeconds * 1000
            sendJson(res, 200, { room: roomPayload(room) })
            return
          }

          const suggestMatch = path.match(/^\/api\/rooms\/(\d{4})\/suggestions$/)
          if (suggestMatch && method === 'POST') {
            const room = rooms.get(suggestMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            if (room.phase !== 'lobby') {
              sendJson(res, 400, { error: 'Places are locked once voting starts' })
              return
            }

            const body = (await readBody(req)) as {
              memberId?: string
              placeId?: string
            }
            const member = room.members.find((m) => m.id === body.memberId)
            if (!member) {
              sendJson(res, 403, { error: 'Join the room first' })
              return
            }
            const placeId = body.placeId?.trim()
            if (!placeId) {
              sendJson(res, 400, { error: 'placeId is required' })
              return
            }
            if (room.suggestions.some((s) => s.placeId === placeId)) {
              sendJson(res, 200, { room: roomPayload(room) })
              return
            }
            if (room.suggestions.length >= MAX_SUGGESTIONS) {
              sendJson(res, 400, {
                error: `Room is full (max ${MAX_SUGGESTIONS} places)`,
              })
              return
            }

            room.suggestions.push({
              placeId,
              addedById: member.id,
              addedByName: member.name,
            })
            sendJson(res, 200, { room: roomPayload(room) })
            return
          }

          const voteMatch = path.match(/^\/api\/rooms\/(\d{4})\/vote$/)
          if (voteMatch && method === 'POST') {
            const room = rooms.get(voteMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            finalizeIfExpired(room)
            if (room.phase !== 'voting') {
              sendJson(res, 400, { error: 'Voting is not open' })
              return
            }

            const body = (await readBody(req)) as {
              memberId?: string
              placeId?: string | null
            }
            const member = room.members.find((m) => m.id === body.memberId)
            if (!member) {
              sendJson(res, 403, { error: 'Join the room first' })
              return
            }

            if (!body.placeId) {
              delete room.votes[member.id]
              sendJson(res, 200, { room: roomPayload(room) })
              return
            }

            if (!room.suggestions.some((s) => s.placeId === body.placeId)) {
              sendJson(res, 400, { error: 'Place is not in this room' })
              return
            }

            room.votes[member.id] = body.placeId
            sendJson(res, 200, { room: roomPayload(room) })
            return
          }

          // Host can end early before the timer hits zero
          const revealMatch = path.match(/^\/api\/rooms\/(\d{4})\/reveal$/)
          if (revealMatch && method === 'POST') {
            const room = rooms.get(revealMatch[1]!)
            if (!room) {
              sendJson(res, 404, { error: 'Room not found' })
              return
            }
            if (room.suggestions.length === 0) {
              sendJson(res, 400, { error: 'Add at least one place first' })
              return
            }

            const body = (await readBody(req)) as { memberId?: string }
            if (!requireHost(room, body.memberId)) {
              sendJson(res, 403, { error: 'Only the host can end voting early' })
              return
            }
            if (room.phase === 'lobby') {
              sendJson(res, 400, { error: 'Start voting first' })
              return
            }

            room.phase = 'results'
            room.votingEndsAt = Date.now()
            room.winnerId = pickWinner(room)
            sendJson(res, 200, { room: roomPayload(room) })
            return
          }

          sendJson(res, 404, { error: 'Not found' })
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Server error',
          })
        }
      })
    },
  }
}
