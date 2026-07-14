import { useMemo } from 'react'
import { useTripStore } from '../../store'
import { DAY_COLORS } from '../../lib/spotKind'
import { formatDayLabel } from '../../lib/date'

export function DayTimeline() {
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const cities = useTripStore((s) => s.cities)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const setMapFocusDayId = useTripStore((s) => s.setMapFocusDayId)

  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  const cityNameOf = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  if (sortedDays.length === 0) return null

  return (
    <div className="flex w-[120px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-slate-200 bg-white/90 py-2 backdrop-blur">
      <div className="flex flex-col gap-1.5 px-2">
      {sortedDays.map((day, idx) => {
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        const isActive = mapFocusDayId === day.id
        const city = cityNameOf(day.cityId)
        return (
          <button
            key={day.id}
            type="button"
            onClick={() => setMapFocusDayId(isActive ? null : day.id)}
            className={`group flex w-full flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
              isActive
                ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-200'
                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
            }`}
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <span className="font-semibold text-slate-800">
              第 {day.dayIndex} 天
            </span>
            {day.date && (
              <span className="text-[10px] font-normal text-slate-500">
                {formatDayLabel(day.date)}
              </span>
            )}
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
