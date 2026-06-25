import { useTripStore } from '../store'
import { ArrangePanel } from './ArrangePanel'
import { CollectPanel } from './CollectPanel'

/**
 * Routes between Step 1 (CollectPanel) and Step 2 (ArrangePanel).
 * Wraps both in a fade transition so the mode change feels intentional
 * but not disruptive.
 */
export function LeftColumn({ className }: { className?: string }) {
  const appMode = useTripStore((s) => s.appMode)
  return (
    <div className={`relative flex min-h-0 flex-col ${className ?? ''}`}>
      <div
        key={appMode}
        className="flex min-h-0 flex-1 flex-col animate-fade-slide"
      >
        {appMode === 'collect' ? <CollectPanel /> : <ArrangePanel />}
      </div>
    </div>
  )
}
