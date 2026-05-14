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
import { SPOT_KIND_ICON, SPOT_KIND_LABEL, spotKind } from '../lib/spotKind'
import { useTripStore } from '../store/tripStore'
import type { Spot } from '../types'
import { Btn } from './ui'
import { SpotContextMenu, useSpotContextMenu } from './SpotContextMenu'

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

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * Format an ISO date string (YYYY-MM-DD) into a human-friendly
 * day-card header form: "11/12 周四". Falls back to the raw string
 * if parsing fails. The date is intentionally treated as local
 * midnight to avoid off-by-one issues across timezones.
 */
function formatDayLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (Number.isNaN(dt.getTime())) return iso
  const weekday = WEEKDAY_CN[dt.getDay()]
  return `${mo}/${d} ${weekday}`
}

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
function encodeDaySortId(dayId: string) {
  return `day-sort::${dayId}`
}
function decodeDragId(id: string):
  | { kind: 'pool'; spotId: string }
  | { kind: 'day'; dayId: string; spotId: string }
  | { kind: 'day-sort'; dayId: string }
  | null {
  if (id.startsWith('pool::')) {
    return { kind: 'pool', spotId: id.slice('pool::'.length) }
  }
  if (id.startsWith('day-sort::')) {
    return { kind: 'day-sort', dayId: id.slice('day-sort::'.length) }
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

function PoolChip({
  spot,
  onContext,
}: {
  spot: Spot
  onContext: (e: React.MouseEvent, s: Spot) => void
}) {
  const id = encodePoolDragId(spot.id)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const focused = useTripStore((s) => s.mapFocusSpotId === spot.id)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  const k = spotKind(spot)
  return (
    <div
      ref={setNodeRef}
      onContextMenu={(e) => onContext(e, spot)}
      className={`group inline-flex items-center gap-1 overflow-hidden rounded-full border bg-white shadow-sm transition ${
        isDragging
          ? 'opacity-30'
          : focused
            ? 'border-teal-400 ring-2 ring-teal-200'
            : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/50'
      }`}
    >
      <button
        type="button"
        onClick={() => setMapFocusSpotId(spot.id)}
        onDoubleClick={() => setSpotDetail(spot)}
        {...listeners}
        {...attributes}
        className={`flex cursor-grab touch-none items-center gap-1 px-2.5 py-1 text-[11px] font-medium active:cursor-grabbing ${
          focused ? 'text-teal-800' : 'text-slate-700'
        }`}
        title={SPOT_KIND_LABEL[k]}
      >
        <span>{SPOT_KIND_ICON[k]}</span>
        <span>{spot.name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setSpotDetail(spot)
        }}
        className="hidden h-6 w-6 shrink-0 items-center justify-center text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-teal-700 group-hover:flex"
        title="编辑"
        aria-label="编辑"
      >
        ✏️
      </button>
    </div>
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
  onContext,
}: {
  spot: Spot
  dayId: string
  index: number
  color: string
  onRemove: () => void
  focused: boolean
  onFocus: () => void
  onContext: (e: React.MouseEvent, s: Spot, dayId: string) => void
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
      onContextMenu={(e) => onContext(e, spot, dayId)}
      className={`group flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 transition ${
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
        <span className="mr-1">{SPOT_KIND_ICON[spotKind(spot)]}</span>
        {spot.name}
      </button>
      <button
        type="button"
        onClick={() => setSpotDetail(spot)}
        className="shrink-0 rounded px-1 py-0.5 text-[12px] text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-teal-700 group-hover:opacity-100"
        title="编辑"
        aria-label="编辑"
      >
        ✏️
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-[11px] text-slate-400 hover:text-red-600"
        aria-label="移出该天"
        title="移出该天"
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
  showCityRow,
  color,
  spots,
  collapsed,
  onToggleCollapsed,
  onContext,
}: {
  dayId: string
  dayIndex: number
  date?: string
  cityName: string
  showCityRow: boolean
  color: string
  spots: Spot[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onContext: (e: React.MouseEvent, s: Spot, dayId: string) => void
}) {
  const openDayPlanFor = useTripStore((s) => s.openDayPlanFor)
  const removeSpotFromDay = useTripStore((s) => s.removeSpotFromDay)
  const setMapFocusDayId = useTripStore((s) => s.setMapFocusDayId)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)

  const daySortId = encodeDaySortId(dayId)
  const {
    attributes: dayAttrs,
    listeners: dayListeners,
    setNodeRef: setDayDragRef,
    isDragging: isDayDragging,
  } = useDraggable({ id: daySortId })

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
      className={`warm-card shadow-stone-sm overflow-hidden border bg-[#f8f2e4] transition ${
        isOver ? 'border-teal-400 ring-2 ring-teal-200' : 'border-slate-200/80'
      }`}
    >
      <header
        className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 py-2.5 pl-3 pr-4 transition ${
          isDayDragging ? 'opacity-40' : ''
        }`}
        style={{
          background: mapFocusDayId === dayId ? `${color}20` : `${color}10`,
          borderLeft: `${mapFocusDayId === dayId ? 5 : 3}px solid ${color}`,
        }}
        onClick={() => {
          // Clicking the header both focuses this day on the map AND toggles
          // collapse. Users on long (12-day) trips use the toggle constantly;
          // users on short trips don't notice because short trips never need
          // to collapse. The header being the whole click target means we
          // don't need a visible triangle icon — big affordance, zero chrome.
          setMapFocusDayId(dayId)
          onToggleCollapsed()
        }}
        title="单击定位地图到这一天 · 折叠/展开"
      >
        <button
          type="button"
          ref={setDayDragRef}
          {...dayListeners}
          {...dayAttrs}
          className="flex h-5 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          title="拖动调整天数顺序"
          aria-label="拖动调整天数顺序"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M7 3.75A.75.75 0 017.75 3h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 3.75zM7 7.75A.75.75 0 017.75 7h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 7.75zM7 11.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM7 15.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-slate-900">
              第 {dayIndex} 天
            </span>
            {date && (
              <span className="text-[12px] font-medium text-slate-600">
                {formatDayLabel(date)}
              </span>
            )}
          </div>
          {showCityRow && (
            <div className="mt-0.5 text-[11px] text-slate-500">{cityName}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
            {spots.length} 个
          </span>
          {overStuffed && (
            <span
              className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200"
              title="景点偏多或路程偏长,可以考虑拆到下一天"
            >
              {dayKm.toFixed(1)} km ⚠️
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="group flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-teal-50 hover:text-teal-700"
            onClick={(e) => {
              e.stopPropagation()
              openDayPlanFor(dayId)
            }}
            title="编辑这一天"
            aria-label="编辑这一天"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="gear-hover h-4 w-4"
              aria-hidden
            >
              {/* Heroicons-style gear (cog-6-tooth, outline → filled).
                  On hover, the parent .group triggers a continuous slow
                  rotation via the .gear-hover animation in index.css. */}
              <path
                fillRule="evenodd"
                d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 0 1-.517.608 7.45 7.45 0 0 0-.478.198.798.798 0 0 1-.796-.064l-.453-.324a1.875 1.875 0 0 0-2.416.2l-.243.243a1.875 1.875 0 0 0-.2 2.416l.324.453a.798.798 0 0 1 .064.796 7.448 7.448 0 0 0-.198.478.798.798 0 0 1-.608.517l-.55.092a1.875 1.875 0 0 0-1.566 1.849v.344c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 0 1-.064.796l-.324.453a1.875 1.875 0 0 0 .2 2.416l.243.243c.648.648 1.67.733 2.416.2l.453-.324a.798.798 0 0 1 .796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h.344c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 0 1 .517-.608 7.52 7.52 0 0 0 .478-.198.798.798 0 0 1 .796.064l.453.324a1.875 1.875 0 0 0 2.416-.2l.243-.243c.648-.648.733-1.67.2-2.416l-.324-.453a.798.798 0 0 1-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.091a1.875 1.875 0 0 0 1.566-1.85v-.344c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 0 1-.608-.517 7.507 7.507 0 0 0-.198-.478.798.798 0 0 1 .064-.796l.324-.453a1.875 1.875 0 0 0-.2-2.416l-.243-.243a1.875 1.875 0 0 0-2.416-.2l-.453.324a.798.798 0 0 1-.796.064 7.462 7.462 0 0 0-.478-.198.798.798 0 0 1-.517-.608l-.091-.55a1.875 1.875 0 0 0-1.85-1.566h-.344ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>
      {!collapsed &&
        (spots.length === 0 ? (
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
                  onContext={onContext}
                />
              ))}
            </ol>
          </SortableContext>
        ))}
    </section>
  )
}

function PoolDropArea({
  unassigned,
  isDraggingFromDay,
  onContext,
}: {
  unassigned: Spot[]
  isDraggingFromDay: boolean
  onContext: (e: React.MouseEvent, s: Spot) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROP_ID })
  return (
    <section
      ref={setNodeRef}
      className={`warm-card shadow-stone-sm shrink-0 overflow-hidden border bg-[#f8f2e4] transition ${
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
              <PoolChip key={s.id} spot={s} onContext={onContext} />
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
  // Collapse state for each day card, keyed by dayId. Lifted from the
  // individual DayCard so the "折叠/展开全部" toolbar button can batch-
  // toggle every day at once. `true` = collapsed, missing/false = expanded.
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

    // 5) Day sort → another day card (reorder days)
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
            className="stone-button shadow-stone flex-1 justify-center !py-3.5 font-serif text-[15px] font-semibold"
            onClick={() => setAppMode('collect')}
          >
            ← 上一步
          </Btn>
          {sortedDays.length > 0 && (
            <Btn
              variant="primary"
              className="stone-button shadow-stone !px-4 !py-3.5 font-serif !text-[13px] font-semibold"
              onClick={() => {
                // Same fill/color/shadow as 上一步 (per user request) — they
                // belong to the same toolbar and read as a connected pair.
                // Slightly smaller text size keeps "上一步" as the visual lead
                // when both buttons sit side by side.
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
              // Show the per-day city line only when the trip spans multiple
              // cities. Single-city trips get a cleaner header without the
              // redundant city caption on every card.
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
