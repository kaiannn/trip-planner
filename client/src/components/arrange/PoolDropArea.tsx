import { useDroppable } from '@dnd-kit/core'
import { POOL_DROP_ID } from '../../lib/dragId'
import type { Spot } from '../../types'
import { PoolChip } from './PoolChip'

export function PoolDropArea({
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
      className={`rounded-xl shadow-sm shrink-0 overflow-hidden border bg-[#f8f2e4] transition ${
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
