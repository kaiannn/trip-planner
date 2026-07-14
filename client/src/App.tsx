import { useEffect } from 'react'
import { Header } from './components/Header'
import { MapLayout } from './components/layout/MapLayout'
import { DayPlanModal } from './components/modals/DayPlanModal'
import { SettingsModal } from './components/modals/SettingsModal'
import { SpotDetailModal } from './components/modals/SpotDetailModal'
import { SpotPoolModal } from './components/modals/SpotPoolModal'
import { TripWizardModal } from './components/modals/TripWizardModal'
import { useSettingsStore } from './store/settingsStore'

export default function App() {
  const checkKeys = useSettingsStore((s) => s.checkKeys)

  useEffect(() => { checkKeys() }, [checkKeys])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 pb-4 pt-3 md:px-6">
        <MapLayout />
      </main>
      <SpotPoolModal />
      <DayPlanModal />
      <TripWizardModal />
      <SpotDetailModal />
      <SettingsModal />
    </div>
  )
}
