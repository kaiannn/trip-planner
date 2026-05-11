import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { distanceInMeters } from '../lib/geo'
import { useTripStore } from '../store/tripStore'
import type { Spot } from '../types'
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

const POOL_DROP_ID = 'pool-drop-zone'

/**
 * Drag-source IDs are encoded so handleDragEnd can tell where the
 * dragged item came from:
 *   pool::<spotId>           — drag a pool chip
 *   day::<dayId>::<spotId>   — drag a day row
 */
function encodePoolDragId(spotId: string) {
  return `pool::${spotId}`
}
function encodeDayDragId(dayId: string, spotId: string) {
  return `day::${dayId}::${spotId}`
}
function decodeDragId(id: string):
  | { kind: 'pool'; spotId: string }
  | { kind: 'day'; dayId: string; spotId: string }
  | null {
  if (id.startsWith('pool::')) {
    return { kind: 'pool', spotId: id.slice('pool::'.length) }
  }
  if (id.startsWith('day::')) {
    const rest = id.slice('day::'.length)
    const sep = rest.indexOf('::')
    if (sep < 0) return null
    return {
      kind: 'day',
      dayId: rest.slice(0, sep),
      spotId: rest.slice(sep + 2),
    }
  }
  return null
}
function decodeDropId(id: string):
  | { kind: 'pool' }
  | { kind: 'day'; dayId: string }
  | { kind: 'day-row'; dayId: string; spotId: string }
  | null {
  if (id === POOL_DROP_ID) return { kind: 'pool' }
  if (id.startsWith('day-drop::')) {
    return { kind: 'day', dayId: id.slice('day-drop::'.length) }
  }
  if (id.startsWith('day::')) {
    // Used as a sortable item ID inside a SortableContext.
    const rest = id.slice('day::'.length)
    const sep = rest.indexOf('::')
    if (sep < 0) return null
    return {
      kind: 'day-row',
      dayId: rest.slice(0, sep),
      spotId: rest.slice(sep + 2),
    }
  }
  return null
}

function PoolChip({ spot }: { spot: Spot }) {
  const id = encodePoolDragId(spot.id)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const focused = useTripStore((s) => s.mapFocusSpotId === spot.id)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => setMapFocusSpotId(spot.id)}
      onDoubleClick={() => setSpotDetail(spot)}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm transition active:cursor-grabbing ${
        isDragging
          ? 'opacity-30'
          : focused
            ? 'border-teal-400 text-teal-800 ring-2 ring-teal-200'
            : 'border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-teal-50/50'
      }`}
    >
      {spot.name}
    </button>
  )
}

function DayRow({
  spot,
  dayId,
  index,
  color,
  onRemove,
  focused,
  onFocus,
}: {
  spot: Spot
  dayId: string
  index: number
  color: string
  onRemove: () => void
  focused: boolean
  onFocus: () => void
}) {
  const id = encodeDayDragId(dayId, spot.id)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 transition ${
        isDragging ? 'opacity-30' : ''
      } ${focused ? 'bg-teal-50/60 ring-1 ring-inset ring-teal-300' : ''}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="flex h-5 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-[10px] font-bold text-white active:cursor-grabbing"
        style={{ background: color }}
        aria-label="拖动调整顺序"
      >
        {index + 1}
      </button>
      <button
        type="button"
        onClick={onFocus}
        onDoubleClick={() => setSpotDetail(spot)}
        className="flex-1 truncate text-left font-medium hover:text-teal-700"
      >
        {spot.name}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-[11px] text-slate-400 hover:text-red-600"
        aria-label="移出该天"
      >
        ×
      </button>
    </li>
  )
}

function DayCard({
  dayId,
  dayIndex,
  date,
  cityName,
  color,
  spots,
}: {
  dayId: string
  dayIndex: number
  date?: string
  cityName: string
  color: string
  spots: Spot[]
}) {
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const removeSpotFromDay = useTripStore((s) => s.removeSpotFromDay)
  const setMapFocusDayId = useTripStore((s) => s.setMapFocusDayId)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)

  // Whole-card drop zone (so dropping anywhere on the card adds to the day).
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `day-drop::${dayId}`,
  })

  const itemIds = useMemo(
    () => spots.map((s) => encodeDayDragId(dayId, s.id)),
    [dayId, spots],
  )

  // Realism summary: total straight-line km between consecutive spots.
  // Cheap & always-available; AMap.Driving cache lives in MapPanel and we
  // don't want to duplicate it here. Good enough as a "is this day overstuffed"
  // hint. Walking + transfers add overhead so we treat >40 km as a soft warning.
  const dayKm = useMemo(() => {
    let m = 0
    for (let i = 0; i < spots.length - 1; i++) {
      const a = spots[i].location
      const b = spots[i + 1].location
      m += distanceInMeters(a.lat, a.lng, b.lat, b.lng)
    }
    return m / 1000
  }, [spots])
  const overStuffed = spots.length > 5 || dayKm > 40

  return (
    <section
      ref={setDropRef}
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-slate-900/[0.03] transition ${
        isOver ? 'border-teal-400 ring-2 ring-teal-200' : 'border-slate-200/80'
      }`}
    >
      <header
        className={`flex cursor-pointer items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 transition ${
          mapFocusDayId === dayId ? 'ring-2 ring-inset ring-teal-300' : ''
        }`}
        style={{ background: `${color}10` }}
        onClick={() => setMapFocusDayId(dayId)}
        title="点击定位地图到这一天"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-sm font-semibold text-slate-800">
              第 {dayIndex} 天
            </span>
            {date && (
              <span className="text-[11px] text-slate-500">{date}</span>
            )}
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
              {spots.length} 个
            </span>
            {spots.length >= 2 && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
                  overStuffed
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                }`}
                title={overStuffed ? '景点偏多或路程偏长,可以考虑拆到下一天' : ''}
              >
                ≈ {dayKm.toFixed(1)} km
                {overStuffed ? ' ⚠️' : ''}
              </span>
            )}
          </div>
          {cityName && (
            <div className="mt-0.5 text-[11px] text-slate-500">{cityName}</div>
          )}
        </div>
        <Btn
          variant="ghost"
          className="!py-1 !text-[11px]"
          onClick={(e) => {
            e.stopPropagation()
            setDayPlanOpen(true)
          }}
        >
          编辑
        </Btn>
      </header>
      {spots.length === 0 ? (
        <div
          className={`px-3 py-6 text-center text-[12px] transition ${
            isOver
              ? 'border border-dashed border-teal-400 bg-teal-50/50 text-teal-700'
              : 'border-t border-dashed border-slate-200 bg-slate-50/40 text-slate-400'
          }`}
        >
          {isOver ? '松开放到这一天' : '把池里的景点拖到这里'}
        </div>
      ) : (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ol className="divide-y divide-slate-100">
            {spots.map((spot, i) => (
              <DayRow
                key={spot.id}
                spot={spot}
                dayId={dayId}
                index={i}
                color={color}
                onRemove={() => removeSpotFromDay(spot.id, dayId)}
                focused={mapFocusSpotId === spot.id}
                onFocus={() => setMapFocusSpotId(spot.id)}
              />
            ))}
          </ol>
        </SortableContext>
      )}
    </section>
  )
}

function PoolDropArea({
  unassigned,
  isDraggingFromDay,
}: {
  unassigned: Spot[]
  isDraggingFromDay: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROP_ID })
  return (
    <section
      ref={setNodeRef}
      className={`shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-slate-900/[0.03] transition ${
        isOver
          ? 'border-amber-400 ring-2 ring-amber-200'
          : isDraggingFromDay
            ? 'border-amber-300'
            : 'border-slate-200/80'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5">
        <span className="text-xs font-semibold text-slate-700">
          📌 景点池
          <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
            {unassigned.length} 未分配
          </span>
        </span>
        <span className="text-[10px] text-slate-400">
          {isDraggingFromDay ? '拖回这里 = 从该天移除' : '把池里的景点拖到上面天数'}
        </span>
      </header>
      <div className="max-h-32 overflow-y-auto p-1.5">
        {unassigned.length === 0 ? (
          <p className="px-2 py-3 text-center text-[11px] text-slate-400">
            全部景点都已分配。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {unassigned.map((s) => (
              <PoolChip key={s.id} spot={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Step 2 — Arrange mode (with drag-and-drop wiring).
 *
 * Drag sources:
 *   - pool chip (from PoolDropArea)
 *   - a row inside a day card
 *
 * Drop targets:
 *   - any day card (whole card area)
 *   - the pool area (drag back from a day)
 *   - another row inside the SAME day (sortable reorder)
 */
export function ArrangePanel({ className }: { className?: string }) {
  const setAppMode = useTripStore((s) => s.setAppMode)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const assignSpotToDay = useTripStore((s) => s.assignSpotToDay)
  const moveSpotBetweenDays = useTripStore((s) => s.moveSpotBetweenDays)
  const removeSpotFromDay = useTripStore((s) => s.removeSpotFromDay)
  const setDaySpotOrder = useTripStore((s) => s.setDaySpotOrder)

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

  const cityNameOf = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  const spotById = (id: string) => spots.find((s) => s.id === id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeSpot = activeId
    ? (() => {
        const decoded = decodeDragId(activeId)
        if (!decoded) return null
        return spotById(decoded.spotId) ?? null
      })()
    : null
  const isDraggingFromDay =
    !!activeId && decodeDragId(activeId)?.kind === 'day'

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const src = decodeDragId(String(e.active.id))
    const dst = decodeDropId(String(e.over.id))
    if (!src || !dst) return

    // 1) Pool → day (any drop spot inside the day card)
    if (src.kind === 'pool' && (dst.kind === 'day' || dst.kind === 'day-row')) {
      const dayId = dst.kind === 'day' ? dst.dayId : dst.dayId
      assignSpotToDay(src.spotId, dayId)
      return
    }

    // 2) Day row → pool (remove from day)
    if (src.kind === 'day' && dst.kind === 'pool') {
      removeSpotFromDay(src.spotId, src.dayId)
      return
    }

    // 3) Day row → another day card (move between days)
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

    // 4) Day row → another row in the SAME day (sortable reorder)
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
              拖动池里的景点 chip 到任意一天。也可以在天数之间互拖,或拖回池里。同一天内拖动数字编号可以调整顺序。
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {sortedDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center text-[12px] text-slate-500">
              还没有任何天数。回到景点池,先把行程日期填上,系统会自动创建天数。
            </div>
          ) : (
            sortedDays.map((day, idx) => {
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
                  color={color}
                  spots={orderedSpots}
                />
              )
            })
          )}
        </div>

        <PoolDropArea
          unassigned={unassigned}
          isDraggingFromDay={isDraggingFromDay}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSpot ? (
          <div className="rounded-full border border-teal-300 bg-white px-2.5 py-1 text-[11px] font-medium text-teal-800 shadow-lg">
            {activeSpot.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
