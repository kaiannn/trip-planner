import { useEffect, useRef, useState } from 'react'
import { useTripStore } from '../store/tripStore'
import type { Spot } from '../types'

interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

/**
 * Shared right-click menu for spots. Usage:
 *
 *   const menu = useSpotContextMenu()
 *   <button onContextMenu={(e) => menu.open(e, spot, { removeFromDayId: 'd1' })}>
 *
 * Render the menu once somewhere high in the tree:
 *   <SpotContextMenu menu={menu} />
 */
export interface SpotMenuContext {
  removeFromDayId?: string
}

export function useSpotContextMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [target, setTarget] = useState<Spot | null>(null)
  const [ctx, setCtx] = useState<SpotMenuContext>({})

  const open = (
    e: React.MouseEvent,
    spot: Spot,
    context: SpotMenuContext = {},
  ) => {
    e.preventDefault()
    setTarget(spot)
    setCtx(context)
    setPos({ x: e.clientX, y: e.clientY })
  }
  const close = () => {
    setPos(null)
    setTarget(null)
    setCtx({})
  }
  return { pos, target, ctx, open, close }
}

export function SpotContextMenu({
  menu,
}: {
  menu: ReturnType<typeof useSpotContextMenu>
}) {
  const { pos, target, ctx, close } = menu
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const removeSpotFromDay = useTripStore((s) => s.removeSpotFromDay)
  const removeSpot = useTripStore((s) => s.removeSpot)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!pos) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [pos, close])

  if (!pos || !target) return null

  const items: MenuItem[] = [
    {
      label: '✏️ 编辑',
      onClick: () => {
        setSpotDetail(target)
        close()
      },
    },
    {
      label: '📍 定位到地图',
      onClick: () => {
        setMapFocusSpotId(target.id)
        close()
      },
    },
  ]
  if (ctx.removeFromDayId) {
    items.push({
      label: '↩︎ 从该天移除(回到池)',
      onClick: () => {
        removeSpotFromDay(target.id, ctx.removeFromDayId!)
        close()
      },
    })
  }
  items.push({
    label: '🗑 删除景点',
    danger: true,
    onClick: () => {
      if (window.confirm(`确认删除景点「${target.name}」?`)) {
        removeSpot(target.id)
      }
      close()
    },
  })

  // Simple viewport clamp so the menu doesn't spill off the right edge.
  const estimatedWidth = 192
  const maxX = window.innerWidth - estimatedWidth - 8
  const x = Math.min(pos.x, maxX)

  return (
    <div
      ref={ref}
      className="fixed z-[1200] min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/[0.04]"
      style={{ top: pos.y + 4, left: x }}
      role="menu"
    >
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
        {target.name}
      </div>
      <ul className="py-1">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={it.onClick}
              className={`w-full px-3 py-1.5 text-left text-[12px] transition hover:bg-slate-50 ${
                it.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'
              }`}
              role="menuitem"
            >
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
