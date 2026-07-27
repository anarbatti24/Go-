/**
 * Generate a UUID that works outside secure contexts.
 *
 * `crypto.randomUUID()` throws on plain HTTP LAN hosts (e.g. 192.168.x.x),
 * which silently breaks "Create group" when testing with a phone.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // fall through — insecure context
    }
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
