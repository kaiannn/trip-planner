import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { DAY_COLORS } from '../lib/spotKind'
import { decodeDragId, decodeDropId } from '../lib/dragId'
import { useTripStore } from '../store'
import { useAssignedSpotIds, useUnassignedSpots } from '../hooks/useTripData'
import type { Spot } from '../types'
import { Btn } from './ui'
import { SpotContextMenu, useSpotContextMenu } from './SpotContextMenu'
import { DayCard } from './arrange/DayCard'
import { PoolDropArea } from './arrange/PoolDropArea'

export function ArrangePanel({ className }: { className?: string }) {
  const setAppMode = useTripStore((s) => s.setAppMode)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const assignSpotToDay = useTripStore((s) => s.assignSpotToDay)
  const moveSpotBetweenDays = useTripStore((s) => s.moveSpotBetweenDays)
  const removeSpotFromDay = useTripStore((s) => s.removeSpotFromDay)
  const setDaySpotOrder = useTripStore((s) => s.setDaySpotOrder)
  const reorderDays = useTripStore((s) => s.reorderDays)
  const menu = useSpotContextMenu()

  const openPoolContext = (e: React.MouseEvent, s: Spot) => {
    menu.open(e, s)
  }
  const openDayContext = (e: React.MouseEvent, s: Spot, dayId: string) => {
    menu.open(e, s, { removeFromDayId: dayId })
  }

  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  const assignedIds = useAssignedSpotIds(dailyPlans)
  const unassigned = useUnassignedSpots(spots, assignedIds)

  const cityNameOf = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  const spotById = (id: string) => spots.find((s) => s.id === id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsedDayIds, setCollapsedDayIds] = useState<
    Record<string, boolean>
  >({})
  const activeSpot = activeId
    ? (() => {
        const decoded = decodeDragId(activeId)
        if (!decoded || decoded.kind === 'day-sort') return null
        return spotById(decoded.spotId) ?? null
      })()
    : null
  const isDraggingFromDay =
    !!activeId && decodeDragId(activeId)?.kind === 'day'
  const isDraggingDaySort =
    !!activeId && decodeDragId(activeId)?.kind === 'day-sort'

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const src = decodeDragId(String(e.active.id))
    const dst = decodeDropId(String(e.over.id))
    if (!src || !dst) return

    if (src.kind === 'pool' && (dst.kind === 'day' || dst.kind === 'day-row')) {
      const dayId = dst.kind === 'day' ? dst.dayId : dst.dayId
      assignSpotToDay(src.spotId, dayId)
      return
    }

    if (src.kind === 'day' && dst.kind === 'pool') {
      removeSpotFromDay(src.spotId, src.dayId)
      return
    }

    if (
      src.kind === 'day' &&
      (dst.kind === 'day' || dst.kind === 'day-row') &&
      ((dst.kind === 'day' && dst.dayId !== src.dayId) ||
        (dst.kind === 'day-row' && dst.dayId !== src.dayId))
    ) {
      const targetDayId = dst.kind === 'day' ? dst.dayId : dst.dayId
      moveSpotBetweenDays(src.spotId, src.dayId, targetDayId)
      return
    }

    if (
      src.kind === 'day' &&
      dst.kind === 'day-row' &&
      dst.dayId === src.dayId &&
      src.spotId !== dst.spotId
    ) {
      const day = dailyPlans.find((d) => d.id === src.dayId)
      if (!day) return
      const oldIdx = day.spotOrder.indexOf(src.spotId)
      const newIdx = day.spotOrder.indexOf(dst.spotId)
      if (oldIdx < 0 || newIdx < 0) return
      const next = arrayMove(day.spotOrder, oldIdx, newIdx)
      setDaySpotOrder(src.dayId, next)
      return
    }

    if (src.kind === 'day-sort' && dst.kind === 'day' && dst.dayId !== src.dayId) {
      reorderDays(src.dayId, dst.dayId)
      return
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={`flex min-h-0 flex-col gap-2 ${className ?? ''}`}>
        <div className="flex shrink-0 items-center gap-2">
          <Btn
            variant="primary"
            className="rounded-lg shadow-md flex-1 justify-center !py-3.5 font-serif text-[15px] font-semibold"
            onClick={() => setAppMode('collect')}
          >
            ← 上一步
          </Btn>
          {sortedDays.length > 0 && (
            <Btn
              variant="primary"
              className="rounded-lg shadow-md !px-4 !py-3.5 font-serif !text-[13px] font-semibold"
              onClick={() => {
                const allCollapsed =
                  sortedDays.length > 0 &&
                  sortedDays.every((d) => collapsedDayIds[d.id])
                const next: Record<string, boolean> = {}
                if (!allCollapsed) {
                  for (const d of sortedDays) next[d.id] = true
                }
                setCollapsedDayIds(next)
              }}
              title="折叠/展开全部天数"
            >
              {sortedDays.every((d) => collapsedDayIds[d.id])
                ? '展开全部'
                : '折叠全部'}
            </Btn>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {sortedDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center text-[12px] text-slate-500">
              还没有任何天数。回到景点池,先把行程日期填上,系统会自动创建天数。
            </div>
          ) : (
            (() => {
              const uniqueCityIds = new Set(sortedDays.map((d) => d.cityId))
              const showCityRow = uniqueCityIds.size > 1
              return sortedDays.map((day, idx) => {
                const color = DAY_COLORS[idx % DAY_COLORS.length]
                const orderedSpots = day.spotOrder
                  .map(spotById)
                  .filter((s): s is Spot => Boolean(s))
                return (
                  <DayCard
                    key={day.id}
                    dayId={day.id}
                    dayIndex={day.dayIndex}
                    date={day.date}
                    cityName={cityNameOf(day.cityId)}
                    showCityRow={showCityRow}
                    color={color}
                    spots={orderedSpots}
                    collapsed={!!collapsedDayIds[day.id]}
                    onToggleCollapsed={() =>
                      setCollapsedDayIds((prev) => ({
                        ...prev,
                        [day.id]: !prev[day.id],
                      }))
                    }
                    onContext={openDayContext}
                  />
                )
              })
            })()
          )}
        </div>

        <PoolDropArea
          unassigned={unassigned}
          isDraggingFromDay={isDraggingFromDay}
          onContext={openPoolContext}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSpot ? (
          <div className="rounded-full border border-teal-300 bg-white px-2.5 py-1 text-[11px] font-medium text-teal-800 shadow-lg">
            {activeSpot.name}
          </div>
        ) : isDraggingDaySort ? (
          (() => {
            const decoded = activeId ? decodeDragId(activeId) : null
            if (!decoded || decoded.kind !== 'day-sort') return null
            const day = dailyPlans.find((d) => d.id === decoded.dayId)
            if (!day) return null
            const idx = sortedDays.findIndex((d) => d.id === day.id)
            const color = DAY_COLORS[idx % DAY_COLORS.length]
            return (
              <div
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-xl"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                第 {day.dayIndex} 天
                {day.date ? <span className="ml-2 text-[11px] font-normal text-slate-400">{day.date}</span> : null}
              </div>
            )
          })()
        ) : null}
      </DragOverlay>

      <SpotContextMenu menu={menu} />
    </DndContext>
  )
}
