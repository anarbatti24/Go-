/**
 * Modal — reusable overlay dialog
 *
 * Vision: keep interruptions lightweight inside the phone shell — not the full
 * desktop viewport. Portals into `#go-phone-shell` so overlays stay in the
 * mobile frame while still sitting above scrollable content.
 */

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export const PHONE_SHELL_ID = 'go-phone-shell'

interface ModalProps {
  title: string
  /** Called when the backdrop or X button is used */
  onClose: () => void
  children: ReactNode
}

function getPhoneShell(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(PHONE_SHELL_ID)
}

/**
 * Accessible dialog shell. Pass any form/content as `children`.
 * Parent owns open/close state — this component is presentational.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const [mountNode] = useState(getPhoneShell)

  if (!mountNode) return null

  return createPortal(
    <div
      className="absolute inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    mountNode,
  )
}
