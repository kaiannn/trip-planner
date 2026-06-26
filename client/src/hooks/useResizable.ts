import { useCallback, useRef, useState } from 'react'

export function useResizable({
  initialWidth,
  initialHeight,
  minWidth = 300,
  minHeight = 200,
}: {
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
}) {
  const [width, setWidth] = useState(initialWidth)
  const [height, setHeight] = useState(initialHeight)
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: width ?? 0,
        h: height ?? 0,
      }

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startRef.current.x
        const dy = ev.clientY - startRef.current.y
        setWidth(Math.max(minWidth, startRef.current.w + dx))
        setHeight(Math.max(minHeight, startRef.current.h + dy))
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [width, height, minWidth, minHeight],
  )

  return { width, height, onResizeStart }
}
