'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[1600px]',
} as const

export interface ModalProps {
  /** Called when the user clicks the X, the backdrop, or presses Escape. */
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  /** Extra content rendered in the header row, next to the close button. */
  headerActions?: React.ReactNode
  size?: keyof typeof sizes
  /** Fixed-height panel (95vh) for full-screen experiences like the scorebook. */
  tall?: boolean
  /** Remove body padding, for tables that should touch the edges. */
  flush?: boolean
  footer?: React.ReactNode
  /** Disable Escape closing (e.g. while saving, or for the live scorebook). */
  locked?: boolean
  /** Also close when the dark backdrop is clicked. Off by default so forms are not lost by a stray click. */
  closeOnBackdrop?: boolean
  className?: string
  children: React.ReactNode
}

export function Modal({
  onClose,
  title,
  description,
  headerActions,
  size = 'md',
  tall = false,
  flush = false,
  footer,
  locked = false,
  closeOnBackdrop = false,
  className,
  children,
}: ModalProps) {
  React.useEffect(() => {
    if (locked) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, locked])

  // Prevent the page behind from scrolling while a modal is open.
  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm animate-in fade-in duration-150 sm:p-6"
      onMouseDown={(e) => {
        if (closeOnBackdrop && !locked && e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-150',
          tall ? 'h-[95vh]' : 'max-h-[92vh]',
          sizes[size],
          className
        )}
      >
        {(title || headerActions) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              {title && <h3 className="text-lg font-semibold leading-tight tracking-tight">{title}</h3>}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                <X />
              </Button>
            </div>
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto scrollbar-thin', !flush && 'p-5 sm:p-6')}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-slate-50/80 px-5 py-3 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
