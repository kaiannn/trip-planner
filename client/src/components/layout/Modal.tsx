import { useEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  label,
  children,
  panelClassName,
  fullScreen = false,
  closeOnBackdrop = true,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  panelClassName?: string
  fullScreen?: boolean
  closeOnBackdrop?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    prevFocusRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current

    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement,
          )
        : []

    const t = window.setTimeout(() => {
      const list = focusables()
      ;(list[0] ?? panel)?.focus()
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      prevFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[5000] backdrop-blur-sm',
        fullScreen
          ? 'flex flex-col bg-sky-50/98'
          : 'flex items-center justify-center bg-slate-900/60 p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (!closeOnBackdrop) return
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          fullScreen
            ? 'flex h-full w-full flex-col overflow-hidden outline-none'
            : 'max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
