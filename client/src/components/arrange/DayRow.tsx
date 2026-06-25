import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SPOT_KIND_ICON, spotKind } from '../../lib/spotKind'
import { encodeDayDragId } from '../../lib/dragId'
import { useTripStore } from '../../store'
import type { Spot } from '../../types'

export function DayRow({
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
