import { useCallback, useRef, useState } from 'react'

export function useResizable({
  containerRef,
  minWidth = 300,
  minHeight = 200,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  minWidth?: number
  minHeight?: number
}) {
  const [size, setSize] = useState<{ width?: number; height?: number }>({})
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: rect.width,
        h: rect.height,
      }

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startRef.current.x
        const dy = ev.clientY - startRef.current.y
        setSize({
          width: Math.max(minWidth, startRef.current.w + dx),
          height: Math.max(minHeight, startRef.current.h + dy),
        })
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [containerRef, minWidth, minHeight],
  )

  return { size, onResizeStart }
}
