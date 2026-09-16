interface LegendItem {
  key: string
  color: string
  label: string
  dashed?: boolean
}

/** Compact legend chips floating over the map (does not steal map height). */
export function MapLegend({
  items,
  onResetView,
}: {
  items: LegendItem[]
  onResetView?: () => void
}) {
  if (!items.length && !onResetView) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex max-w-[min(70%,28rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5">
      {items.map((item) => (
        <div
          key={item.key}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-600 shadow-sm backdrop-blur-sm"
        >
          <span
            className="h-0.5 w-3.5 rounded-full"
            style={{
              background: item.color,
              borderStyle: item.dashed ? 'dashed' : undefined,
            }}
          />
          <span className="font-medium text-slate-700">{item.label}</span>
        </div>
      ))}
      {onResetView && (
        <button
          type="button"
          onClick={onResetView}
          className="pointer-events-auto rounded-md border border-slate-200/90 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-white"
          title="清除焦点，缩回总览"
        >
          重置视图
        </button>
      )}
    </div>
  )
}
