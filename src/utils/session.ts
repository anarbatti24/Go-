/**
 * Lightweight per-browser identity for event rooms.
 *
 * Vision: no auth yet, so we remember a display name + which member id you got
 * when you created/joined a room. Stored in sessionStorage so a refresh keeps
 * you in the room, but a new browser profile starts clean.
 */

const DISPLAY_NAME_KEY = 'go-display-name'
const ROOM_MEMBER_PREFIX = 'go-room-member:'

export function getDisplayName(): string {
  return sessionStorage.getItem(DISPLAY_NAME_KEY) ?? ''
}

export function setDisplayName(name: string) {
  sessionStorage.setItem(DISPLAY_NAME_KEY, name.trim())
}

export function getRoomMemberId(code: string): string | null {
  return sessionStorage.getItem(`${ROOM_MEMBER_PREFIX}${code}`)
}

export function setRoomMemberId(code: string, memberId: string) {
  sessionStorage.setItem(`${ROOM_MEMBER_PREFIX}${code}`, memberId)
}
