import { useMemo, useState } from 'react'
import { useTripStore } from '../../store'
import { SPOT_KIND_ICON, spotKind } from '../../lib/spotKind'
import { useAssignedSpotIds, useUnassignedSpots } from '../../hooks/useTripData'
import type { SpotKind } from '../../types'

type Filter = 'all' | SpotKind

export function FloatingSpotPool() {
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const cities = useTripStore((s) => s.cities)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const setSpotPoolOpen = useTripStore((s) => s.setSpotPoolOpen)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)

  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const assignedIds = useAssignedSpotIds(dailyPlans)
  const unassigned = useUnassignedSpots(spots, assignedIds)

  const counts = useMemo(() => {
    const out = { all: 0, sight: 0, hotel: 0, restaurant: 0 }
    unassigned.forEach((s) => {
      out.all += 1
      out[spotKind(s)] += 1
    })
    return out
  }, [unassigned])

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? unassigned
        : unassigned.filter((s) => spotKind(s) === filter),
    [unassigned, filter],
  )

  const cityName = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  return (
    <div className="absolute right-3 top-3 z-10 w-64 rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <header
        className="flex cursor-pointer items-center justify-between gap-2 border-b border-slate-100 px-3 py-2"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs font-semibold text-slate-700">
          📌 景点池
          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {unassigned.length}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSpotPoolOpen(true)
            }}
            className="rounded px-1.5 py-0.5 text-[10px] text-teal-600 hover:bg-teal-50"
          >
            添加
          </button>
          <span className="text-[10px] text-slate-400">
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </header>

      {!collapsed && (
        <>
          <div className="flex gap-1 border-b border-slate-100 px-2 py-1">
            {(['all', 'sight', 'hotel', 'restaurant'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition ${
                  filter === f
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? '全部' : SPOT_KIND_ICON[f]} {counts[f]}
              </button>
            ))}
          </div>

          <div className="max-h-48 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-slate-400">
                {spots.length === 0 ? '景点池为空' : '全部已分配'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((s) => {
                  const focused = mapFocusSpotId === s.id
                  const k = spotKind(s)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setMapFocusSpotId(s.id)}
                        onDoubleClick={() => setSpotDetail(s)}
                        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition ${
                          focused
                            ? 'bg-teal-50 text-teal-800'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{SPOT_KIND_ICON[k]}</span>
                        <span className="flex-1 truncate text-left font-medium">
                          {s.name}
                        </span>
                        <span className="shrink-0 text-[9px] text-slate-400">
                          {cityName(s.cityId)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
