import { MapPanel } from '../MapPanel'
import { DayTimeline } from '../timeline/DayTimeline'
import { FloatingSpotPool } from '../pool/FloatingSpotPool'
import { AiSeedPanel } from '../AiSeedPanel'

export function MapLayout() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MapPanel />
        <AiSeedPanel />
        <FloatingSpotPool />
      </div>
      <DayTimeline />
    </div>
  )
}
