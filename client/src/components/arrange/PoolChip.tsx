import { useDraggable } from '@dnd-kit/core'
import { SPOT_KIND_ICON, SPOT_KIND_LABEL, spotKind } from '../../lib/spotKind'
import { encodePoolDragId } from '../../lib/dragId'
import { useTripStore } from '../../store'
import type { Spot } from '../../types'

export function PoolChip({
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
