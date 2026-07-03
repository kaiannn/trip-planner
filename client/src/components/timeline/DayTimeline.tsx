import { useCallback, useMemo, useRef, useState } from 'react'
import { useTripStore } from '../../store'
import { DAY_COLORS } from '../../lib/spotKind'
import { formatDayLabel } from '../../lib/date'

export function DayTimeline() {
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const cities = useTripStore((s) => s.cities)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const setMapFocusDayId = useTripStore((s) => s.setMapFocusDayId)

  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const el = resizeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const parentRect = el.parentElement?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const origX = rect.left - parentRect.left
    const origY = rect.top - parentRect.top
    const onMove = (ev: MouseEvent) => {
      setPosition({ x: origX + (ev.clientX - startX), y: origY + (ev.clientY - startY) })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startHeight = resizeRef.current?.offsetHeight ?? 80
    const startWidth = resizeRef.current?.offsetWidth ?? 800
    const onMove = (ev: MouseEvent) => {
      setPanelHeight(Math.max(60, startHeight - (ev.clientY - startY)))
      setPanelWidth(Math.max(200, startWidth + (ev.clientX - startX)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  const cityNameOf = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  if (sortedDays.length === 0) return null

  return (
    <div
      ref={resizeRef}
      onMouseDown={handleDragStart}
      className="group absolute z-10 flex cursor-move flex-col gap-2 overflow-x-auto rounded-t-xl border border-slate-200 bg-white/90 shadow-lg backdrop-blur"
      style={{
        height: panelHeight ?? undefined,
        width: panelWidth ?? undefined,
        left: position?.x ?? 0,
        top: position?.y ?? undefined,
        bottom: position ? undefined : 0,
        right: 0,
      }}
    >
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 right-0 top-0 z-10 flex h-3 cursor-nesw-resize items-start justify-center opacity-0 transition group-hover:opacity-100"
      >
        <div className="mt-1 h-0.5 w-8 rounded-full bg-slate-300" />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2">
      {sortedDays.map((day, idx) => {
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        const isActive = mapFocusDayId === day.id
        const city = cityNameOf(day.cityId)
        return (
          <button
            key={day.id}
            type="button"
            onClick={() => setMapFocusDayId(isActive ? null : day.id)}
            className={`group flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-1.5 text-left text-[11px] transition ${
              isActive
                ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-200'
                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
            }`}
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <span className="font-semibold text-slate-800">
              第 {day.dayIndex} 天
              {day.date && (
                <span className="ml-1 font-normal text-slate-500">
                  {formatDayLabel(day.date)}
                </span>
              )}
            </span>
            {city && (
              <span className="text-[10px] text-slate-500">{city}</span>
            )}
            <span className="text-[10px] text-slate-400">
              {day.spotOrder.length} 个景点
            </span>
          </button>
        )
        })}
      </div>
    </div>
  )
}
