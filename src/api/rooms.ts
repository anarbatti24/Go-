/**
 * Client for the Vite rooms API (`/api/rooms/...`).
 *
 * Vision: the UI talks only to these helpers so swapping to a real backend later
 * is mostly a URL / auth change. Every mutating call returns the fresh room.
 */

import type { EventRoom } from '../types'

export type RoomView = EventRoom & {
  tallies: Record<string, number>
  /** Server clock — use to sync the voting countdown. */
  serverNow: number
}

type RoomResponse = { room: RoomView; memberId?: string; error?: string }

async function request(
  path: string,
  init?: RequestInit,
): Promise<RoomResponse> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const data = (await res.json()) as RoomResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export async function createRoom(input: {
  groupId: string
  groupName: string
  hostName: string
  placeIds: string[]
}): Promise<{ room: RoomView; memberId: string }> {
  const data = await request('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!data.memberId) throw new Error('Missing memberId')
  return { room: data.room, memberId: data.memberId }
}

export async function fetchRoom(code: string): Promise<RoomView> {
  const data = await request(`/api/rooms/${code}`)
  return data.room
}

export async function joinRoom(
  code: string,
  name: string,
): Promise<{ room: RoomView; memberId: string }> {
  const data = await request(`/api/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  if (!data.memberId) throw new Error('Missing memberId')
  return { room: data.room, memberId: data.memberId }
}

export async function updateRoomSettings(
  code: string,
  memberId: string,
  voteDurationSeconds: number,
): Promise<RoomView> {
  const data = await request(`/api/rooms/${code}/settings`, {
    method: 'POST',
    body: JSON.stringify({ memberId, voteDurationSeconds }),
  })
  return data.room
}

export async function startVoting(
  code: string,
  memberId: string,
  voteDurationSeconds?: number,
): Promise<RoomView> {
  const data = await request(`/api/rooms/${code}/start`, {
    method: 'POST',
    body: JSON.stringify({ memberId, voteDurationSeconds }),
  })
  return data.room
}

export async function addSuggestion(
  code: string,
  memberId: string,
  placeId: string,
): Promise<RoomView> {
  const data = await request(`/api/rooms/${code}/suggestions`, {
    method: 'POST',
    body: JSON.stringify({ memberId, placeId }),
  })
  return data.room
}

export async function castRoomVote(
  code: string,
  memberId: string,
  placeId: string | null,
): Promise<RoomView> {
  const data = await request(`/api/rooms/${code}/vote`, {
    method: 'POST',
    body: JSON.stringify({ memberId, placeId }),
  })
  return data.room
}

export async function revealRoomWinner(
  code: string,
  memberId: string,
): Promise<RoomView> {
  const data = await request(`/api/rooms/${code}/reveal`, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  })
  return data.room
}
