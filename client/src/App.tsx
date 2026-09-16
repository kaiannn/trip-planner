import { useEffect } from 'react'
import { Header } from './components/Header'
import { MapLayout } from './components/layout/MapLayout'
import { AiSeedModal } from './components/AiSeedPanel'
import { SettingsModal } from './components/modals/SettingsModal'
import { SpotDetailModal } from './components/modals/SpotDetailModal'
import { SpotPoolModal } from './components/modals/SpotPoolModal'
import { TripWizardModal } from './components/modals/TripWizardModal'
import { useSettingsStore } from './store/settingsStore'
import { CyclingRouteBookModal } from './cycling/CyclingRouteBookModal'

export default function App() {
  const checkKeys = useSettingsStore((s) => s.checkKeys)

  useEffect(() => { checkKeys() }, [checkKeys])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      <Header />
      {/* Map owns the entire remaining viewport — panels float on top. */}
      <main className="relative min-h-0 flex-1">
        <MapLayout />
      </main>
      <AiSeedModal />
      <SpotPoolModal />
      <TripWizardModal />
      <SpotDetailModal />
      <SettingsModal />
      <CyclingRouteBookModal />
    </div>
  )
}
