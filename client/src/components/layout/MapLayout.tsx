import { MapPanel } from '../MapPanel'
import { DayTimeline } from '../timeline/DayTimeline'
import { FloatingSpotPool } from '../pool/FloatingSpotPool'
import { useResizable } from '../../hooks/useResizable'

export function MapLayout() {
  const { width, height, onResizeStart } = useResizable({
    minHeight: 300,
    minWidth: 400,
  })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="relative min-h-0 flex-1"
        style={width && height ? { width, height, flex: 'none' } : undefined}
      >
        <MapPanel />
        <FloatingSpotPool />
        <div
          onMouseDown={onResizeStart}
          className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-se-resize rounded-br-lg bg-slate-300/50 hover:bg-slate-400/70"
          title="拖拽调整地图大小"
        />
      </div>
      <DayTimeline />
    </div>
  )
}
