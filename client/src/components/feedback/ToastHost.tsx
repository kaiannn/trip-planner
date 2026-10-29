import { useEffect, useRef, useState } from 'react'
import { useLogStore } from '../../store/logStore'
import type { LogEntry, LogLevel } from '../../types'

const TOAST_MS = 4200
const MAX_VISIBLE = 4

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: 'border-teal-300/70 bg-white text-slate-800',
  warn: 'border-amber-300/80 bg-amber-50 text-amber-900',
  error: 'border-red-300/80 bg-red-50 text-red-900',
}

const LEVEL_DOT: Record<LogLevel, string> = {
  info: 'bg-teal-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: '提示',
  warn: '注意',
  error: '错误',
}

/**
 * Surfaces logStore writes as transient toasts.
 * On mount, pre-existing logs are marked seen without flashing old history.
 */
export function ToastHost() {
  const logs = useLogStore((s) => s.logs)
  const [toasts, setToasts] = useState<LogEntry[]>([])
  const seenRef = useRef<Set<string> | null>(null)
  const timersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(logs.map((l) => l.id))
      return
    }
    const seen = seenRef.current
    const fresh = logs.filter((l) => !seen.has(l.id)).slice(0, MAX_VISIBLE)
    if (!fresh.length) return
    fresh.forEach((l) => seen.add(l.id))
    setToasts((prev) => [...fresh, ...prev].slice(0, MAX_VISIBLE))
    fresh.forEach((l) => {
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== l.id))
        timersRef.current.delete(l.id)
      }, TOAST_MS)
      timersRef.current.set(l.id, timer)
    })
  }, [logs])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers.clear()
    }
  }, [])

  if (!toasts.length) return null

  const hasError = toasts.some((t) => t.level === 'error')

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[10050] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      role="status"
      aria-live={hasError ? 'assertive' : 'polite'}
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] leading-snug shadow-lg shadow-slate-900/10 ${LEVEL_CLASS[t.level]}`}
        >
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[t.level]}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <span className="sr-only">{LEVEL_LABEL[t.level]}：</span>
            <p className="break-words">{t.message}</p>
            <p className="mt-0.5 text-[11px] tabular-nums opacity-60">{t.time}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded px-1 text-[12px] opacity-50 transition hover:opacity-100 focus-visible:opacity-100"
            aria-label="关闭提示"
            onClick={() => {
              const timer = timersRef.current.get(t.id)
              if (timer) window.clearTimeout(timer)
              timersRef.current.delete(t.id)
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
