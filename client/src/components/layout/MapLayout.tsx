import { MapPanel } from '../MapPanel'
import { DayTimeline } from '../timeline/DayTimeline'
import { FloatingSpotPool } from '../pool/FloatingSpotPool'

export function MapLayout() {
  return (
    <div className="relative flex min-h-0 flex-1">
      <DayTimeline />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MapPanel />
        <FloatingSpotPool />
      </div>
    </div>
  )
}
