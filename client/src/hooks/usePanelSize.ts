import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'trip-planner-panel-sizes'

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'
export type ResizeEdge = 'n' | 'e' | 's' | 'w'

export interface PanelSizeLimits {
  minW: number
  maxW: number
  minH: number
  maxH: number
}

export interface PanelSize {
  w: number
  h: number
}

export interface PanelRect {
  /** clientX of left edge at drag start */
  left: number
  /** clientY of top edge at drag start */
  top: number
  w: number
  h: number
  parentLeft: number
  parentTop: number
  parentW: number
  parentH: number
}

function readStored(id: string): PanelSize | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, PanelSize>
    const v = all[id]
    if (v && Number.isFinite(v.w) && Number.isFinite(v.h)) return v
  } catch {
    /* ignore */
  }
  return null
}

function writeStored(id: string, size: PanelSize) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, PanelSize>) : {}
    all[id] = size
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

function clampSize(size: PanelSize, lim: PanelSizeLimits): PanelSize {
  return {
    w: Math.min(lim.maxW, Math.max(lim.minW, Math.round(size.w))),
    h: Math.min(lim.maxH, Math.max(lim.minH, Math.round(size.h))),
  }
}

/**
 * Window-like resize: the opposite corner stays FIXED on screen.
 * Size limits adjust the dragged edge only — never the fixed one
 * (that was what caused the opposite-corner jump).
 */
export function usePanelSize(opts: {
  id: string
  defaultW: number
  defaultH: number
  limits: PanelSizeLimits
  resetKey?: string | number | boolean | null
  /** When this changes, re-apply defaultW/defaultH (content-driven fit). */
  autoFitKey?: string | number | boolean | null
}) {
  const { id, defaultW, defaultH, limits, resetKey, autoFitKey } = opts
  const [size, setSize] = useState<PanelSize>(() => {
    const stored = readStored(id)
    return stored ? clampSize(stored, limits) : clampSize({ w: defaultW, h: defaultH }, limits)
  })
  const limitsRef = useRef(limits)
  limitsRef.current = limits

  useEffect(() => {
    setSize(clampSize({ w: defaultW, h: defaultH }, limitsRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    if (autoFitKey == null) return
    setSize(clampSize({ w: defaultW, h: defaultH }, limitsRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitKey])

  const persist = useCallback(
    (next: PanelSize) => {
      const c = clampSize(next, limitsRef.current)
      setSize(c)
      writeStored(id, c)
      return c
    },
    [id],
  )

  /**
   * @param rect parent-space geometry at mousedown (left/top already converted)
   * @param apply gets next size + parent-space top-left
   */
  const startCornerResize = useCallback(
    (
      corner: ResizeCorner,
      e: React.MouseEvent,
      rect: PanelRect,
      apply: (s: { w: number; h: number; x: number; y: number }) => void,
    ) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startL = rect.left
      const startT = rect.top
      const startW = rect.w
      const startH = rect.h
      const startR = startL + startW
      const startB = startT + startH
      const lim = limitsRef.current

      // Opposite corner (fixed on screen) in parent space
      const fixedRight = corner === 'ne' || corner === 'se'
      const fixedLeft = corner === 'nw' || corner === 'sw'
      const fixedBottom = corner === 'se' || corner === 'sw'
      const fixedTop = corner === 'ne' || corner === 'nw'

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY

        // 1) Unclamped edges from cursor
        let left = startL
        let top = startT
        let w = startW
        let h = startH

        if (fixedRight) w = startW + dx
        else {
          w = startW - dx
          left = startL + dx
        }
        if (fixedBottom) h = startH + dy
        else {
          h = startH - dy
          top = startT + dy
        }

        // 2) Clamp only the DRAGGED edge; fixed edge never moves
        w = Math.min(lim.maxW, Math.max(lim.minW, Math.round(w)))
        h = Math.min(lim.maxH, Math.max(lim.minH, Math.round(h)))

        if (fixedRight) left = startL
        else left = startR - w
        if (fixedBottom) top = startT
        else top = startB - h

        // 3) If fixed left/top would push dragged edge outside parent,
        //    shrink size — do NOT move the fixed corner.
        if (left < 0) {
          if (fixedRight) w = Math.max(lim.minW, startR) // stay in [0, startR]
          else w = Math.max(lim.minW, Math.min(startR, startR)) // right fixed → w = startR
          left = fixedRight ? 0 : startR - w
          if (fixedRight) w = Math.max(lim.minW, startR)
        }
        if (top < 0) {
          if (fixedBottom) h = Math.max(lim.minH, startB)
          else h = startB
          top = fixedBottom ? 0 : startB - h
        }
        // If fixed right/bottom and dragged edge would exit parent, cap w/h
        if (fixedRight && left + w > rect.parentW) {
          w = Math.max(lim.minW, rect.parentW - left)
        }
        if (fixedBottom && top + h > rect.parentH) {
          h = Math.max(lim.minH, rect.parentH - top)
        }
        // If fixed left/top and dragged edge would exit, cap size at parent
        if (fixedLeft && left + w > rect.parentW) {
          w = Math.max(lim.minW, rect.parentW - left)
        }
        if (fixedTop && top + h > rect.parentH) {
          h = Math.max(lim.minH, rect.parentH - top)
        }

        // Final safety: fixed corner position unchanged
        if (fixedRight) left = startL
        if (fixedLeft) left = startR - w
        if (fixedBottom) top = startT
        if (fixedTop) top = startB - h
        left = Math.round(left)
        top = Math.round(top)

        setSize({ w, h })
        writeStored(id, { w, h })
        apply({ w, h, x: left, y: top })
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [id],
  )

  const startEdgeResize = useCallback(
    (
      edge: ResizeEdge,
      e: React.MouseEvent,
      rect: PanelRect,
      apply: (s: { w: number; h: number; x: number; y: number }) => void,
    ) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startL = rect.left
      const startT = rect.top
      const startW = rect.w
      const startH = rect.h
      const startR = startL + startW
      const startB = startT + startH
      const lim = limitsRef.current

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        let left = startL
        let top = startT
        let w = startW
        let h = startH

        if (edge === 's') h = Math.min(lim.maxH, Math.max(lim.minH, startH + dy))
        if (edge === 'n') {
          h = Math.min(lim.maxH, Math.max(lim.minH, startH - dy))
          top = startB - h
        }
        if (edge === 'e') w = Math.min(lim.maxW, Math.max(lim.minW, startW + dx))
        if (edge === 'w') {
          w = Math.min(lim.maxW, Math.max(lim.minW, startW - dx))
          left = startR - w
        }

        setSize({ w, h })
        writeStored(id, { w, h })
        apply({ w, h, x: Math.round(left), y: Math.round(top) })
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [id],
  )

  const resetSize = useCallback(() => {
    persist({ w: defaultW, h: defaultH })
  }, [defaultW, defaultH, persist])

  return { size, setSize: persist, startCornerResize, startEdgeResize, resetSize }
}
