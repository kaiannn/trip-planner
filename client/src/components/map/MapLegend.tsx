interface LegendItem {
  key: string
  color: string
  label: string
  dashed?: boolean
}

export function MapLegend({
  items,
  onResetView,
}: {
  items: LegendItem[]
  onResetView?: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
      {items.map((item) => (
        <div
          key={item.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2 py-0.5 shadow-sm"
        >
          <span
            className="h-1 w-4 rounded-full"
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
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700 shadow-sm transition hover:bg-teal-50"
          title="清除焦点,缩回总览"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3 w-3"
          >
            <path
              fillRule="evenodd"
              d="M4.5 2A2.5 2.5 0 0 0 2 4.5v3a.75.75 0 0 0 1.5 0v-3a1 1 0 0 1 1-1h3a.75.75 0 0 0 0-1.5h-3Zm8 0a.75.75 0 0 0 0 1.5h3a1 1 0 0 1 1 1v3a.75.75 0 0 0 1.5 0v-3A2.5 2.5 0 0 0 15.5 2h-3Zm-8.75 10.25a.75.75 0 0 1 .75.75v3a1 1 0 0 0 1 1h3a.75.75 0 0 1 0 1.5h-3A2.5 2.5 0 0 1 2 15.5v-3a.75.75 0 0 1 .75-.75Zm13.5 0a.75.75 0 0 1 .75.75v3a2.5 2.5 0 0 1-2.5 2.5h-3a.75.75 0 0 1 0-1.5h3a1 1 0 0 0 1-1v-3a.75.75 0 0 1 .75-.75Z"
              clipRule="evenodd"
            />
          </svg>
          重置视图
        </button>
      )}
    </div>
  )
}
