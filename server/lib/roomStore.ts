/**
 * Room persistence — Upstash Redis REST (fetch) in production, memory locally.
 *
 * Uses raw HTTP so we don't depend on @upstash/redis loading in Vercel.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel.
 */

import type { EventRoom } from './types.js'

const ROOM_TTL_SECONDS = 60 * 60 * 24 // 24h
const KEY_PREFIX = 'go:room:'

export interface RoomStore {
  get(code: string): Promise<EventRoom | null>
  set(code: string, room: EventRoom): Promise<void>
  has(code: string): Promise<boolean>
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

function createMemoryStore(): RoomStore {
  const rooms = memoryMap()
  return {
    backend: 'memory',
    async get(code) {
      return rooms.get(code) ?? null
    },
    async set(code, room) {
      rooms.set(code, room)
    },
    async has(code) {
      return rooms.has(code)
    },
  }
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

function createRedisStore(baseUrl: string, token: string): RoomStore {
  return {
    backend: 'redis',
    async get(code) {
      const result = await upstashCommand(baseUrl, token, [
        'GET',
        `${KEY_PREFIX}${code}`,
      ])
      if (result == null) return null
      if (typeof result === 'string') {
        try {
          return JSON.parse(result) as EventRoom
        } catch {
          return null
        }
      }
      // Upstash may auto-deserialize JSON objects
      return result as EventRoom
    },
    async set(code, room) {
      await upstashCommand(baseUrl, token, [
        'SET',
        `${KEY_PREFIX}${code}`,
        JSON.stringify(room),
        'EX',
        ROOM_TTL_SECONDS,
      ])
    },
    async has(code) {
      const result = await upstashCommand(baseUrl, token, [
        'EXISTS',
        `${KEY_PREFIX}${code}`,
      ])
      return result === 1 || result === true
    },
  }
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

/** Reset cache between tests / hot reloads if needed. */
export function resetRoomStoreCache() {
  cached = null
}
