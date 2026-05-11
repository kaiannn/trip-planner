import { useMemo } from 'react'
import { useTripStore } from '../store/tripStore'
import { Btn } from './ui'

const DAY_COLORS = [
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
]

/**
 * Step 2 — Arrange mode.
 *
 * The user has filled their pool in step 1. Now they distribute pool
 * spots into specific days. Drag-and-drop arrives in Phase 3 — this
 * skeleton just renders the day cards + a pool strip and gives a
 * back button to return to collect mode.
 */
export function ArrangePanel({ className }: { className?: string }) {
  const setAppMode = useTripStore((s) => s.setAppMode)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)

  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  const assignedIds = useMemo(() => {
    const set = new Set<string>()
    dailyPlans.forEach((d) => d.spotOrder.forEach((id) => set.add(id)))
    return set
  }, [dailyPlans])

  const unassigned = useMemo(
    () => spots.filter((s) => !assignedIds.has(s.id)),
    [spots, assignedIds],
  )

  const cityName = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  const spotById = (id: string) => spots.find((s) => s.id === id)

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className ?? ''}`}>
      {/* Header strip with back button + step indicator */}
      <div className="shrink-0">
        <Btn
          variant="ghost"
          className="!px-2 !py-1 !text-xs"
          onClick={() => setAppMode('collect')}
        >
          ← 返回景点池
        </Btn>
        <div className="mt-2 rounded-xl border border-sky-200/60 bg-sky-50/40 px-3 py-2 text-[11px] text-sky-900/80">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
              2
            </span>
            <span className="font-semibold text-sky-900">安排行程</span>
          </div>
          <p className="mt-1 leading-relaxed">
            把池里的景点拖到对应的天数(拖拽功能下一阶段开启)。地图上能看到每个景点的位置 —— 边看地图边规划。
          </p>
        </div>
      </div>

      {/* Day cards — top section */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {sortedDays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center text-[12px] text-slate-500">
            还没有任何天数。回到景点池,先把行程日期填上,系统会自动创建天数。
          </div>
        ) : (
          sortedDays.map((day, idx) => {
            const color = DAY_COLORS[idx % DAY_COLORS.length]
            const orderedSpots = day.spotOrder.map(spotById).filter(Boolean)
            return (
              <section
                key={day.id}
                className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]"
              >
                <header
                  className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2"
                  style={{ background: `${color}10` }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        第 {day.dayIndex} 天
                      </span>
                      {day.date && (
                        <span className="text-[11px] text-slate-500">{day.date}</span>
                      )}
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                        {day.spotOrder.length} 个
                      </span>
                    </div>
                    {cityName(day.cityId) && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {cityName(day.cityId)}
                      </div>
                    )}
                  </div>
                  <Btn
                    variant="ghost"
                    className="!py-1 !text-[11px]"
                    onClick={() => setDayPlanOpen(true)}
                  >
                    编辑
                  </Btn>
                </header>
                {orderedSpots.length === 0 ? (
                  <div className="border border-dashed border-slate-200 bg-slate-50/40 px-3 py-4 text-center text-[12px] text-slate-400">
                    拖景点到这里(下一阶段开启)
                  </div>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {orderedSpots.map((spot, i) =>
                      spot ? (
                        <li
                          key={spot.id}
                          className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700"
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: color }}
                          >
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate font-medium">
                            {spot.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSpotDetail(spot)}
                            className="text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            查看
                          </button>
                        </li>
                      ) : null,
                    )}
                  </ol>
                )}
              </section>
            )
          })
        )}
      </div>

      {/* Pool strip — bottom of arrange panel */}
      <section className="shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5">
          <span className="text-xs font-semibold text-slate-700">
            📌 景点池
            <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
              {unassigned.length} 未分配
            </span>
          </span>
          <span className="text-[10px] text-slate-400">下一阶段:拖到上方天数</span>
        </header>
        <div className="max-h-32 overflow-y-auto p-1.5">
          {unassigned.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-slate-400">
              全部景点都已分配。
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {unassigned.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpotDetail(s)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/50"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
