/**
 * Modal — reusable overlay dialog
 *
 * Vision: keep interruptions lightweight. We use this for:
 *   - Place details on My Roams
 *   - "New Group" creation form
 *
 * Backdrop tap closes; inner panel stops propagation so content clicks don't
 * dismiss by accident. Anchored to the bottom on narrow screens (thumb-friendly)
 * and centered on larger ones.
 */

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  /** Called when the backdrop or X button is used */
  onClose: () => void
  children: ReactNode
}

/**
 * Accessible dialog shell. Pass any form/content as `children`.
 * Parent owns open/close state — this component is presentational.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      {/* stopPropagation: clicking inside the sheet shouldn't close it */}
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
    </div>
  )
}
