import { useEffect, useMemo, useState } from 'react'
import { useTripStore } from '../../store'
import { Btn } from '../ui'
import { WeatherChip } from '../WeatherChip'
import { FloatingPanel } from '../layout/FloatingPanel'
import { SPOT_KIND_LABEL, spotKind } from '../../lib/spotKind'
import { resolveDaySpotOrder } from '../../lib/resolveDayPath'
import { getDayItemDragData, getSpotDragData, isDayItemDrag, isSpotDrag, setDayItemDragData } from '../../lib/dnd'
import type { Spot } from '../../types'

/**
 * Day organizer — draggable peer of the spot pool.
 * Default dock: right side. Pool snaps left when this opens.
 */
export function DayPlanPanel() {
  const open = useTripStore((s) => s.dayPlanOpen)
  const editDayId = useTripStore((s) => s.dayPlanEditDayId)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const deleteDay = useTripStore((s) => s.deleteDay)
  const setDaySpotOrder = useTripStore((s) => s.setDaySpotOrder)
  const assignSpotToActivePath = useTripStore((s) => s.assignSpotToActivePath)
  const removeSpotFromDay = useTripStore((s) => s.removeSpotFromDay)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)

  const day = dailyPlans.find((d) => d.id === editDayId) ?? null
  const city = day ? cities.find((c) => c.id === day.cityId) : null

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listDragOver, setListDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  /** Reorder: spot being dragged from the day list. */
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  /** Reorder: index shown as insert target (null = none). */
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const activeOrder = useMemo(
    () => (day ? resolveDaySpotOrder(day) : []),
    [day],
  )

  const spotMap = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots])

  useEffect(() => {
    if (!activeOrder.length) {
      setSelectedId(null)
      return
    }
    if (selectedId && activeOrder.includes(selectedId)) return
    setSelectedId(
      mapFocusSpotId && activeOrder.includes(mapFocusSpotId)
        ? mapFocusSpotId
        : activeOrder[0],
    )
  }, [activeOrder, selectedId, mapFocusSpotId])

  // Reset collapse when switching days
  useEffect(() => {
    setCollapsed(false)
  }, [editDayId])

  if (!open) return null

  if (!day) {
    return (
      <FloatingPanel
        title="整理行程"
        subtitle="没有选中的天"
        collapsed={false}
        onToggleCollapse={() => setDayPlanOpen(false)}
        defaultDock="tr"
        widthClassName="w-[20rem]"
        resetDockKey="empty"
        actions={
          <Btn
            variant="secondary"
            className="!px-2 !py-0.5 !text-[11px]"
            onClick={() => setDayPlanOpen(false)}
          >
            关闭
          </Btn>
        }
      >
        <p className="text-[12px] text-slate-500">先在底部日程里选一天，再打开整理。</p>
      </FloatingPanel>
    )
  }

  const selected: Spot | null = selectedId ? (spotMap.get(selectedId) ?? null) : null
  const branchLabel = day.activeBranchId
    ? (day.dayBranches?.find((b) => b.id === day.activeBranchId)?.label ?? '分支')
    : '默认计划'

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= activeOrder.length) return
    const next = activeOrder.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setDaySpotOrder(day.id, next)
  }

  /** Insert `spotId` so it ends up at `toIndex` after removing it from its old slot. */
  const reorderTo = (spotId: string, toIndex: number) => {
    const from = activeOrder.indexOf(spotId)
    if (from < 0) return
    let target = toIndex
    if (target > from) target -= 1
    move(from, target)
  }

  return (
    <FloatingPanel
      title={`第 ${day.dayIndex} 天 · 整理行程`}
      subtitle={`${city?.name || '未分配城市'} · 「${branchLabel}」 · ${activeOrder.length} 站 · 拖角调大小`}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      defaultDock="tr"
      sizeId="day-organizer-v2"
      defaultBodyHeight={520}
      minBodyHeight={260}
      minW={320}
      maxWRatio={0.72}
      maxHRatio={0.88}
      resizable
      bodyClassName="!p-0"
      resetDockKey={editDayId}
      actions={
        <>
          {day.date && city?.name && <WeatherChip city={city.name} date={day.date} />}
          <Btn
            variant="ghost"
            className="!px-1.5 !py-0.5 !text-[11px] text-red-600 hover:bg-red-50"
            onClick={() => {
              if (window.confirm(`确定删除第 ${day.dayIndex} 天吗?`)) {
                deleteDay(day.id)
                setDayPlanOpen(false)
              }
            }}
          >
            删除
          </Btn>
          <Btn
            variant="secondary"
            className="!px-1.5 !py-0.5 !text-[11px]"
            onClick={() => setDayPlanOpen(false)}
          >
            关闭
          </Btn>
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        {/* Left: list */}
        <aside
          className={`flex w-[46%] shrink-0 flex-col border-r transition-colors ${
            listDragOver || dropIndex != null
              ? 'border-slate-800/50 bg-slate-50'
              : 'border-slate-100 bg-slate-50/40'
          }`}
          onDragOver={(e) => {
            if (isDayItemDrag(e.dataTransfer)) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dropIndex == null) setDropIndex(activeOrder.length)
              return
            }
            if (!isSpotDrag(e.dataTransfer)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setListDragOver(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setListDragOver(false)
              setDropIndex(null)
            }
          }}
          onDrop={(e) => {
            if (isDayItemDrag(e.dataTransfer)) {
              e.preventDefault()
              e.stopPropagation()
              const id = getDayItemDragData(e.dataTransfer)
              const idx = dropIndex ?? activeOrder.length
              setDragItemId(null)
              setDropIndex(null)
              if (id) reorderTo(id, idx)
              return
            }
            if (!isSpotDrag(e.dataTransfer)) return
            e.preventDefault()
            setListDragOver(false)
            const id = getSpotDragData(e.dataTransfer)
            if (id) {
              assignSpotToActivePath(id, day.id)
              setSelectedId(id)
            }
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
            <span className="text-[11px] font-semibold text-slate-700">当日站点</span>
            <span className="text-[10px] text-slate-400">
              {listDragOver ? '松开加入' : '可从景点池拖入'}
            </span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {activeOrder.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 px-2 py-6 text-center text-[11px] leading-relaxed text-slate-400">
                把景点池里的景点拖到这里
              </li>
            )}
            {activeOrder.map((sid, i) => {
              const sp = spotMap.get(sid)
              const k = sp ? spotKind(sp) : 'sight'
              const selectedRow = selectedId === sid
              const isDragging = dragItemId === sid
              const showInsertBefore = dropIndex === i && dragItemId && dragItemId !== sid
              return (
                <li key={sid}>
                  {showInsertBefore && (
                    <div className="mb-1 h-0.5 rounded-full bg-slate-800" />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDayItemDragData(e.dataTransfer, sid)
                      setDragItemId(sid)
                      setSelectedId(sid)
                    }}
                    onDragEnd={() => {
                      setDragItemId(null)
                      setDropIndex(null)
                    }}
                    onDragOver={(e) => {
                      if (!isDayItemDrag(e.dataTransfer)) return
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                      // Insert above this row if cursor is in the top half.
                      const rect = e.currentTarget.getBoundingClientRect()
                      const before = e.clientY < rect.top + rect.height / 2
                      setDropIndex(before ? i : i + 1)
                    }}
                    onDrop={(e) => {
                      if (!isDayItemDrag(e.dataTransfer)) return
                      e.preventDefault()
                      e.stopPropagation()
                      const id = getDayItemDragData(e.dataTransfer)
                      const target = dropIndex ?? i
                      setDragItemId(null)
                      setDropIndex(null)
                      if (id) reorderTo(id, target)
                    }}
                    className={`mb-1 flex cursor-grab items-center gap-1 rounded-lg border px-1.5 py-1 select-none active:cursor-grabbing ${
                      isDragging
                        ? 'border-slate-400 opacity-50'
                        : selectedRow
                          ? 'border-slate-800/70 bg-white shadow-sm'
                          : 'border-transparent hover:border-slate-200 hover:bg-white'
                    }`}
                    title="拖动调整顺序"
                  >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    onClick={() => {
                      setSelectedId(sid)
                      setMapFocusSpotId(sid)
                    }}
                  >
                    <span className="w-4 shrink-0 text-[10px] tabular-nums text-slate-400">
                      {i + 1}
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-600">
                      {SPOT_KIND_LABEL[k]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-800">
                      {sp?.name ?? '已删除景点'}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded px-1 py-0.5 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                      aria-label="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded px-1 py-0.5 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      disabled={i === activeOrder.length - 1}
                      onClick={() => move(i, i + 1)}
                      aria-label="下移"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="rounded px-1 py-0.5 text-[10px] text-slate-300 hover:bg-red-50 hover:text-red-500"
                      onClick={() => removeSpotFromDay(sid, day.id)}
                      aria-label="移出当天"
                    >
                      ×
                    </button>
                  </div>
                  </div>
                </li>
              )
            })}
            {dragItemId && dropIndex === activeOrder.length && (
              <li>
                <div className="mt-1 h-0.5 rounded-full bg-slate-800" />
              </li>
            )}
          </ul>
        </aside>

        {/* Right: detail */}
        <section className="min-w-0 flex-1 overflow-y-auto p-3">
          {!selected && (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-slate-400">
              <p className="text-[12px]">选择左侧景点查看详情</p>
              <p className="text-[10px]">完整字段见 issue #31</p>
            </div>
          )}
          {selected && (
            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[14px] font-semibold text-slate-900">
                    {selected.name}
                  </h3>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {SPOT_KIND_LABEL[spotKind(selected)]}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {cities.find((c) => c.id === selected.cityId)?.name ?? ''}
                  {selected.location
                    ? ` · ${selected.location.lat.toFixed(4)}, ${selected.location.lng.toFixed(4)}`
                    : ''}
                </p>
              </div>

              {selected.description && (
                <div>
                  <div className="mb-0.5 text-[10px] font-medium text-slate-500">备注</div>
                  <p className="rounded-lg bg-slate-50 p-2 text-[12px] leading-relaxed text-slate-700">
                    {selected.description}
                  </p>
                </div>
              )}

              {selected.innerTransport && (
                <div>
                  <div className="mb-0.5 text-[10px] font-medium text-slate-500">交通</div>
                  <p className="text-[12px] text-slate-700">{selected.innerTransport}</p>
                </div>
              )}

              {'visitTimeText' in selected && selected.visitTimeText && (
                <div>
                  <div className="mb-0.5 text-[10px] font-medium text-slate-500">建议时间</div>
                  <p className="text-[12px] text-slate-700">{selected.visitTimeText}</p>
                </div>
              )}

              {'price' in selected && selected.price && (
                <div>
                  <div className="mb-0.5 text-[10px] font-medium text-slate-500">价格</div>
                  <p className="text-[12px] text-slate-700">{selected.price}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                <Btn
                  variant="primary"
                  className="!px-2.5 !py-1 !text-[11px]"
                  onClick={() => {
                    setMapFocusSpotId(selected.id)
                    setSpotDetail(selected)
                  }}
                >
                  打开完整编辑
                </Btn>
                <Btn
                  variant="secondary"
                  className="!px-2.5 !py-1 !text-[11px]"
                  onClick={() => setMapFocusSpotId(selected.id)}
                >
                  地图定位
                </Btn>
              </div>
            </div>
          )}
        </section>
      </div>
    </FloatingPanel>
  )
}
