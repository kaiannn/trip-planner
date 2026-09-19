import { useCallback, useEffect, useMemo, useRef, useState, type RefObject, type ReactNode } from 'react'
import clsx from 'clsx'
import { usePanelSize, type PanelRect, type ResizeCorner } from '../../hooks/usePanelSize'

type Dock = 'tl' | 'tr' | 'bl' | 'br'

const DOCK_GAP = 12

function dockStyle(dock: Dock): React.CSSProperties {
  switch (dock) {
    case 'tl':
      return { left: DOCK_GAP, top: DOCK_GAP }
    case 'tr':
      return { right: DOCK_GAP, top: DOCK_GAP }
    case 'bl':
      return { left: DOCK_GAP, bottom: DOCK_GAP }
    case 'br':
      return { right: DOCK_GAP, bottom: DOCK_GAP }
  }
}

const CORNER_CLASS: Record<ResizeCorner, string> = {
  se: 'right-0 bottom-0 cursor-nwse-resize',
  sw: 'left-0 bottom-0 cursor-nesw-resize',
  ne: 'right-0 top-0 cursor-nesw-resize',
  nw: 'left-0 top-0 cursor-nwse-resize',
}

/** Parent map box — max panel size scales with this, not fixed px. */
function useParentSize(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const update = () => {
      const el = ref.current
      const parent = (el?.offsetParent as HTMLElement | null) ?? el
      if (!parent) return
      setBox({ w: parent.clientWidth, h: parent.clientHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [ref, enabled])
  return box
}

export interface FloatingPanelProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  collapsed: boolean
  onToggleCollapse: () => void
  widthClassName?: string
  className?: string
  children: ReactNode
  defaultDock?: Dock
  bodyClassName?: string
  defaultBodyHeight?: number
  resizable?: boolean
  /** Soft min sizes (still floor at ~160/80 on tiny screens). */
  minBodyHeight?: number
  minW?: number
  /** Fraction of map parent for max size — responsive, not fixed px. */
  maxWRatio?: number
  maxHRatio?: number
  sizeId?: string
  resetDockKey?: string | number | boolean | null
  resetSizeKey?: string | number | boolean | null
  /** Preferred panel width in px (content-fit); clamped by parent limits. */
  defaultW?: number
  /** Re-apply defaultW/defaultBodyHeight when this key changes (e.g. day count). */
  autoFitKey?: string | number | boolean | null
}

/**
 * Shared chrome for map overlays.
 * Max size = fraction of the map container (responsive).
 */
export function FloatingPanel({
  title,
  subtitle,
  actions,
  collapsed,
  onToggleCollapse,
  widthClassName = 'w-[19rem]',
  className,
  children,
  defaultDock = 'tl',
  bodyClassName,
  defaultBodyHeight = 200,
  resizable = false,
  minBodyHeight = 96,
  minW = 220,
  maxWRatio = 0.92,
  maxHRatio = 0.88,
  sizeId,
  resetDockKey,
  resetSizeKey,
  defaultW: preferredW,
  autoFitKey,
}: FloatingPanelProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const parentSize = useParentSize(elRef, Boolean(resizable))
  const limits = useMemo(() => {
    const pw = parentSize?.w ?? window.innerWidth
    const ph = parentSize?.h ?? window.innerHeight
    return {
      minW: Math.min(minW, Math.floor(pw * 0.5)),
      maxW: Math.max(minW + 40, Math.floor(pw * maxWRatio)),
      minH: Math.min(minBodyHeight, Math.floor(ph * 0.4)),
      maxH: Math.max(minBodyHeight + 40, Math.floor(ph * maxHRatio)),
    }
  }, [parentSize, minW, minBodyHeight, maxWRatio, maxHRatio])

  const { size, startCornerResize, startEdgeResize, resetSize, setSize } = usePanelSize({
    id: sizeId ?? 'panel',
    defaultW: Math.min(preferredW ?? 300, limits.maxW),
    defaultH: Math.min(defaultBodyHeight, limits.maxH),
    limits,
    resetKey: resetSizeKey,
    autoFitKey,
  })

  const sized = resizable

  useEffect(() => {
    setPos(null)
  }, [resetDockKey])

  // Raise panel when content needs more room (e.g. decision tree opens)
  useEffect(() => {
    if (!resizable || collapsed) return
    const floor = Math.min(minBodyHeight, limits.maxH)
    if (size.h < floor) {
      setSize({ w: size.w, h: floor })
    }
  }, [resizable, collapsed, minBodyHeight, limits.maxH, size.h, size.w, setSize])

  const getRect = useCallback((): PanelRect | null => {
    const el = elRef.current
    if (!el) return null
    const parent = el.offsetParent as HTMLElement | null
    const parentRect = parent?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const r = el.getBoundingClientRect()
    // Parent-space left/top — must match CSS left/top on this element
    return {
      left: r.left - parentRect.left,
      top: r.top - parentRect.top,
      w: r.width,
      h: r.height,
      parentLeft: parentRect.left,
      parentTop: parentRect.top,
      parentW: parent?.clientWidth ?? window.innerWidth,
      parentH: parent?.clientHeight ?? window.innerHeight,
    }
  }, [])

  const onGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      const r = getRect()
      if (!r) return
      // Already parent-space
      const origX = r.left
      const origY = r.top
      setPos({ x: origX, y: origY })
      const startX = e.clientX
      const startY = e.clientY
      let moved = false

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
        const maxX = Math.max(0, r.parentW - r.w)
        const maxY = Math.max(0, r.parentH - r.h)
        setPos({
          x: Math.min(maxX, Math.max(0, origX + dx)),
          y: Math.min(maxY, Math.max(0, origY + dy)),
        })
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        if (!moved) onToggleCollapse()
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [getRect, onToggleCollapse],
  )

  const applyResize = useCallback(
    (next: { w: number; h: number; x: number; y: number }) => {
      setPos({ x: next.x, y: next.y })
    },
    [],
  )

  const startResize = (corner: ResizeCorner) => (e: React.MouseEvent) => {
    const r = getRect()
    if (!r) return
    // Anchor left/top in parent space before resize
    setPos({ x: r.left, y: r.top })
    startCornerResize(corner, e, r, applyResize)
  }

  const startEdge = (edge: 'n' | 's' | 'e' | 'w') => (e: React.MouseEvent) => {
    const r = getRect()
    if (!r) return
    setPos({ x: r.left, y: r.top })
    startEdgeResize(edge, e, r, applyResize)
  }

  return (
    <div
      ref={elRef}
      className={clsx(
        'absolute z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-sm',
        !sized && widthClassName,
        className,
      )}
      style={{
        ...(pos ? { left: pos.x, top: pos.y } : dockStyle(defaultDock)),
        ...(resizable
          ? {
              width: size.w,
              height: collapsed ? undefined : size.h,
            }
          : undefined),
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
    >
      <div
        onMouseDown={onGripMouseDown}
        className="flex shrink-0 cursor-grab items-start gap-2 border-b border-slate-100 px-3 py-2 active:cursor-grabbing"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-800">{title}</div>
          {subtitle && !collapsed && (
            <div className="mt-0.5 truncate text-[11px] text-slate-500">{subtitle}</div>
          )}
        </div>
        {actions}
        <button
          type="button"
          className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
          aria-label={collapsed ? '展开' : '收起'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d={collapsed ? 'M2 4.5 L6 8.5 L10 4.5' : 'M2 7.5 L6 3.5 L10 7.5'}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className={clsx('min-h-0 flex-1 overflow-hidden', bodyClassName)}>
          <div className="h-full overflow-y-auto p-3">{children}</div>
        </div>
      )}
      {resizable && !collapsed && (
        <>
          <div
            onMouseDown={startEdge('s')}
            className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize"
            title="下边调高度"
          />
          <div
            onMouseDown={startEdge('e')}
            className="absolute bottom-2 right-0 top-2 w-1.5 cursor-ew-resize"
            title="右边调宽度"
          />
          {(Object.keys(CORNER_CLASS) as ResizeCorner[]).map((c) => (
            <div
              key={c}
              onMouseDown={startResize(c)}
              className={clsx('absolute z-10 h-3.5 w-3.5', CORNER_CLASS[c])}
              title="拖角调整大小"
            >
              {c === 'se' && (
                <div className="absolute bottom-0.5 right-0.5 h-2 w-2 border-b-2 border-r-2 border-slate-400/80" />
              )}
              {c === 'sw' && (
                <div className="absolute bottom-0.5 left-0.5 h-2 w-2 border-b-2 border-l-2 border-slate-400/80" />
              )}
              {c === 'ne' && (
                <div className="absolute right-0.5 top-0.5 h-2 w-2 border-r-2 border-t-2 border-slate-400/80" />
              )}
              {c === 'nw' && (
                <div className="absolute left-0.5 top-0.5 h-2 w-2 border-l-2 border-t-2 border-slate-400/80" />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={resetSize}
            className="absolute bottom-1 left-1 z-10 rounded bg-slate-100/90 px-1 text-[9px] text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            title="恢复默认大小"
          >
            复位
          </button>
        </>
      )}
    </div>
  )
}
