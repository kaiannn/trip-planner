import { MapPanel } from '../MapPanel'
import { DayTimeline } from '../timeline/DayTimeline'
import { FloatingSpotPool } from '../pool/FloatingSpotPool'
import { DayPlanPanel } from '../modals/DayPlanModal'

/**
 * Map-first layout: the map owns the full remaining viewport.
 * Floating panels dock to corners; day organizer must live here so
 * absolute docks are relative to the map, not the whole window.
 */
export function MapLayout() {
  return (
    <div className="absolute inset-0">
      <MapPanel className="absolute inset-0" />
      <FloatingSpotPool />
      <DayTimeline />
      <DayPlanPanel />
    </div>
  )
}
