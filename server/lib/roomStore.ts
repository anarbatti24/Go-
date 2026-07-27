/**
 * Room persistence — Upstash Redis REST (fetch) in production, memory locally.
 *
 * Mutations use versioned compare-and-swap so two friends adding places at the
 * same time don't overwrite each other (last-write-wins bug).
 */

import type { EventRoom } from './types.js'

const ROOM_TTL_SECONDS = 60 * 60 * 24 // 24h
const KEY_PREFIX = 'go:room:'
const MAX_CAS_ATTEMPTS = 12

export type RoomMutator = (room: EventRoom) => void

export interface RoomStore {
  get(code: string): Promise<EventRoom | null>
  set(code: string, room: EventRoom): Promise<void>
  has(code: string): Promise<boolean>
  /** Read → mutate clone → CAS write with retries. */
  update(code: string, mutator: RoomMutator): Promise<EventRoom | null>
  backend: 'redis' | 'memory'
}

declare global {
  var __goRoomsMemory: Map<string, EventRoom> | undefined
}

function memoryMap(): Map<string, EventRoom> {
  if (!globalThis.__goRoomsMemory) {
    globalThis.__goRoomsMemory = new Map()
  }
  return globalThis.__goRoomsMemory
}

function cloneRoom(room: EventRoom): EventRoom {
  return JSON.parse(JSON.stringify(room)) as EventRoom
}

function normalizeRoom(room: EventRoom): EventRoom {
  if (typeof room.version !== 'number') room.version = 0
  return room
}

async function upstashCommand(
  baseUrl: string,
  token: string,
  command: unknown[],
): Promise<unknown> {
  const res = await fetch(baseUrl.replace(/\/$/, ''), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  const raw = await res.text()
  let parsed: { result?: unknown; error?: string }
  try {
    parsed = JSON.parse(raw) as { result?: unknown; error?: string }
  } catch {
    throw new Error(`Upstash returned non-JSON (${res.status}): ${raw.slice(0, 120)}`)
  }

  if (!res.ok || parsed.error) {
    throw new Error(parsed.error || `Upstash error (${res.status})`)
  }

  return parsed.result
}

function parseStoredRoom(result: unknown): EventRoom | null {
  if (result == null) return null
  if (typeof result === 'string') {
    try {
      return normalizeRoom(JSON.parse(result) as EventRoom)
    } catch {
      return null
    }
  }
  return normalizeRoom(result as EventRoom)
}

/**
 * Atomic CAS via Lua: only write if room.version still matches expected.
 * Returns 1 on success, 0 on version conflict, nil if missing.
 */
const CAS_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return nil
end
local ok, room = pcall(cjson.decode, raw)
if not ok then
  return nil
end
local current = 0
if room['version'] ~= nil then
  current = tonumber(room['version']) or 0
end
local expected = tonumber(ARGV[1])
if current ~= expected then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`

function createMemoryStore(): RoomStore {
  const rooms = memoryMap()
  const store: RoomStore = {
    backend: 'memory',
    async get(code) {
      const room = rooms.get(code)
      return room ? cloneRoom(normalizeRoom(room)) : null
    },
    async set(code, room) {
      rooms.set(code, normalizeRoom(cloneRoom(room)))
    },
    async has(code) {
      return rooms.has(code)
    },
    async update(code, mutator) {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
        const current = rooms.get(code)
        if (!current) return null
        const expected = current.version ?? 0
        const next = cloneRoom(normalizeRoom(current))
        mutator(next)
        next.version = expected + 1

        const again = rooms.get(code)
        if (!again || (again.version ?? 0) !== expected) continue

        rooms.set(code, next)
        return cloneRoom(next)
      }
      throw new Error('Room update conflict — try again')
    },
  }
  return store
}

function createRedisStore(baseUrl: string, token: string): RoomStore {
  const key = (code: string) => `${KEY_PREFIX}${code}`

  const store: RoomStore = {
    backend: 'redis',
    async get(code) {
      const result = await upstashCommand(baseUrl, token, ['GET', key(code)])
      return parseStoredRoom(result)
    },
    async set(code, room) {
      const payload = normalizeRoom(cloneRoom(room))
      if (typeof payload.version !== 'number') payload.version = 0
      await upstashCommand(baseUrl, token, [
        'SET',
        key(code),
        JSON.stringify(payload),
        'EX',
        ROOM_TTL_SECONDS,
      ])
    },
    async has(code) {
      const result = await upstashCommand(baseUrl, token, ['EXISTS', key(code)])
      return result === 1 || result === true
    },
    async update(code, mutator) {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
        const current = await store.get(code)
        if (!current) return null

        const expected = current.version ?? 0
        const next = cloneRoom(current)
        mutator(next)
        next.version = expected + 1

        const cas = await upstashCommand(baseUrl, token, [
          'EVAL',
          CAS_LUA,
          1,
          key(code),
          String(expected),
          JSON.stringify(next),
          String(ROOM_TTL_SECONDS),
        ])

        if (cas === 1 || cas === true) return next
        if (cas == null) return null
        // version conflict → retry
      }
      throw new Error('Room update conflict — try again')
    },
  }
  return store
}

let cached: RoomStore | null = null

export function getRoomStore(): RoomStore {
  if (cached) return cached

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (url && token) {
    cached = createRedisStore(url, token)
  } else {
    cached = createMemoryStore()
  }

  return cached
}

export function resetRoomStoreCache() {
  cached = null
}
