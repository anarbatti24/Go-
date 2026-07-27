/**
 * Room persistence — Upstash Redis in production, in-memory for local dev.
 *
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel.
 * Without them, rooms live in a process Map (fine for `npm run dev` only).
 */

import { Redis } from '@upstash/redis'
import type { EventRoom } from './types.ts'

const ROOM_TTL_SECONDS = 60 * 60 * 24 // 24h
const KEY_PREFIX = 'go:room:'

export interface RoomStore {
  get(code: string): Promise<EventRoom | null>
  set(code: string, room: EventRoom): Promise<void>
  has(code: string): Promise<boolean>
  backend: 'redis' | 'memory'
}

declare global {
  // Persist rooms across Vite HMR in local memory mode.
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

function createRedisStore(redis: Redis): RoomStore {
  return {
    backend: 'redis',
    async get(code) {
      const data = await redis.get<EventRoom>(`${KEY_PREFIX}${code}`)
      return data ?? null
    },
    async set(code, room) {
      await redis.set(`${KEY_PREFIX}${code}`, room, { ex: ROOM_TTL_SECONDS })
    },
    async has(code) {
      const exists = await redis.exists(`${KEY_PREFIX}${code}`)
      return exists === 1
    },
  }
}

let cached: RoomStore | null = null

export function getRoomStore(): RoomStore {
  if (cached) return cached

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (url && token) {
    cached = createRedisStore(new Redis({ url, token }))
  } else {
    cached = createMemoryStore()
  }

  return cached
}
