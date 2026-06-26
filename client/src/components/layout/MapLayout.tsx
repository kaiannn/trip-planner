import { useRef } from 'react'
import { MapPanel } from '../MapPanel'
import { DayTimeline } from '../timeline/DayTimeline'
import { FloatingSpotPool } from '../pool/FloatingSpotPool'
import { useResizable } from '../../hooks/useResizable'

export function MapLayout() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const { size, onResizeStart } = useResizable({
    containerRef: mapContainerRef,
    minHeight: 300,
    minWidth: 400,
  })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={mapContainerRef}
        className="relative min-h-0 flex-1"
        style={size.width && size.height ? { width: size.width, height: size.height, flex: 'none' } : undefined}
      >
        <MapPanel />
        <FloatingSpotPool />
        <div
          onMouseDown={onResizeStart}
          className="absolute bottom-0 right-0 z-20 h-5 w-5 cursor-se-resize rounded-br-lg bg-teal-500/70 hover:bg-teal-600 active:bg-teal-700"
          title="拖拽调整地图大小"
        />
      </div>
      <DayTimeline />
    </div>
  )
}
