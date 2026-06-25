import { useMemo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { formatDayLabel } from '../../lib/date'
import { distanceInMeters } from '../../lib/geo'
import { encodeDayDragId, encodeDaySortId } from '../../lib/dragId'
import { useTripStore } from '../../store'
import type { Spot } from '../../types'
import { DayRow } from './DayRow'

export function DayCard({
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

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `day-drop::${dayId}`,
  })

  const itemIds = useMemo(
    () => spots.map((s) => encodeDayDragId(dayId, s.id)),
    [dayId, spots],
  )

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
      className={`rounded-xl shadow-sm overflow-hidden border bg-[#f8f2e4] transition ${
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
