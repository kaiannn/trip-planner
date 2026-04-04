import clsx from 'clsx'
import { useTripStore } from '../store/tripStore'

export function LogPanel({ className }: { className?: string }) {
  const logs = useTripStore((s) => s.logs)

  return (
    <div
      className={clsx(
        'shrink-0 overflow-y-auto rounded-xl border border-slate-200/70 bg-white p-3 text-[11px] shadow-sm ring-1 ring-slate-900/[0.04]',
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]" aria-hidden />
        日志
      </div>
      <div className="space-y-1 font-mono leading-relaxed">
        {logs.map((e) => (
          <div key={e.id} className="flex flex-wrap gap-1.5 text-slate-700">
            <span className="text-slate-400">{e.time}</span>
            <span
              className={clsx(
                e.level === 'error' && 'text-red-600',
                e.level === 'warn' && 'text-amber-700',
                e.level === 'info' && 'text-teal-700',
              )}
            >
              [{e.level.toUpperCase()}]
            </span>
            <span>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
