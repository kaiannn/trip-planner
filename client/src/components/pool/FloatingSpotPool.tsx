import { useMemo, useState } from 'react'
import { useTripStore } from '../../store'
import { SPOT_KIND_LABEL, spotKind } from '../../lib/spotKind'
import { useAssignedSpotIds, useUnassignedSpots } from '../../hooks/useTripData'
import type { SpotKind } from '../../types'
import { FloatingPanel } from '../layout/FloatingPanel'
import { setSpotDragData } from '../../lib/dnd'

type Filter = 'all' | SpotKind

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'sight', label: '景点' },
  { id: 'hotel', label: '酒店' },
  { id: 'restaurant', label: '餐厅' },
]

export function FloatingSpotPool() {
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const cities = useTripStore((s) => s.cities)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const setSpotPoolOpen = useTripStore((s) => s.setSpotPoolOpen)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)
  const assignSpotToActivePath = useTripStore((s) => s.assignSpotToActivePath)
  const dayPlanOpen = useTripStore((s) => s.dayPlanOpen)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const openDayPlanFor = useTripStore((s) => s.openDayPlanFor)
  const ensureDaysForDateRange = useTripStore((s) => s.ensureDaysForDateRange)

  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [assignFor, setAssignFor] = useState<string | null>(null)

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

  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  return (
    <FloatingPanel
      title="景点池"
      subtitle={`${unassigned.length} 未分配 · 拖标题移动 · 拖角调大小`}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      defaultDock={dayPlanOpen ? 'tl' : 'tr'}
      resetDockKey={dayPlanOpen ? 'organizer' : 'map'}
      sizeId="spot-pool-v2"
      resizable
      defaultBodyHeight={400}
      minBodyHeight={200}
      minW={240}
      maxWRatio={0.42}
      maxHRatio={0.72}
      actions={
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSpotPoolOpen(true)
            }}
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
          >
            添加
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const targetId =
                mapFocusDayId ??
                sortedDays[0]?.id ??
                null
              if (!targetId) {
                ensureDaysForDateRange()
                return
              }
              openDayPlanFor(targetId)
            }}
            title="打开整理面板（拖入景点或排序）"
            className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
          >
            分配
          </button>
        </>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
              filter === f.id
                ? 'bg-sky-600 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-slate-400">
          {spots.length === 0 ? '景点池为空' : '全部已分配'}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {filtered.map((s) => {
            const focused = mapFocusSpotId === s.id
            const k = spotKind(s)
            return (
              <li key={s.id}>
                {/* div (not button): nested 「加入」 button would break HTML5 drag */}
                <div
                  draggable
                  onDragStart={(e) => {
                    setSpotDragData(e.dataTransfer, s.id)
                  }}
                  onClick={() => setMapFocusSpotId(s.id)}
                  onDoubleClick={() => setSpotDetail(s)}
                  title="拖到日程天或整理面板 · 双击编辑"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setMapFocusSpotId(s.id)
                    }
                  }}
                  className={`flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition select-none active:cursor-grabbing ${
                    focused
                      ? 'border-slate-800/60 bg-white shadow-sm'
                      : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600">
                    {SPOT_KIND_LABEL[k]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-sky-300 hover:text-sky-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAssignFor(assignFor === s.id ? null : s.id)
                    }}
                  >
                    加入
                  </button>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {cityName(s.cityId)}
                  </span>
                </div>
                {assignFor === s.id && (
                  <div className="mb-1 rounded-md border border-slate-200 bg-slate-50 p-1.5">
                    <p className="mb-1 text-[10px] text-slate-500">加入到当前路径（含选中状况分支）</p>
                    <div className="flex flex-wrap gap-1">
                      {sortedDays.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200 hover:bg-sky-50 hover:text-sky-800"
                          onClick={() => {
                            assignSpotToActivePath(s.id, d.id)
                            setAssignFor(null)
                          }}
                        >
                          D{d.dayIndex}
                          {d.activeBranchId
                            ? ` · ${d.dayBranches?.find((b) => b.id === d.activeBranchId)?.label ?? '分支'}`
                            : ''}
                        </button>
                      ))}
                      {sortedDays.length === 0 && (
                        <span className="text-[11px] text-slate-400">还没有日程</span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FloatingPanel>
  )
}
