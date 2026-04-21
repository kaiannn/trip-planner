import { useEffect } from 'react'
import { Header } from './components/Header'
import { LeftColumn } from './components/LeftColumn'
import { LogPanel } from './components/LogPanel'
import { MapPanel } from './components/MapPanel'
import { DayPlanModal } from './components/modals/DayPlanModal'
import { SettingsModal } from './components/modals/SettingsModal'
import { SpotDetailModal } from './components/modals/SpotDetailModal'
import { SpotPoolModal } from './components/modals/SpotPoolModal'
import { TripWizardModal } from './components/modals/TripWizardModal'
import { useSettingsStore } from './store/settingsStore'

export default function App() {
  const fetchServerKeyStatus = useSettingsStore((s) => s.fetchServerKeyStatus)

  useEffect(() => {
    void fetchServerKeyStatus()
  }, [fetchServerKeyStatus])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-3 px-4 pb-4 pt-3 md:px-6">
        <MapPanel sidebar={<LeftColumn />} />
        <LogPanel className="h-32" />
      </main>
      <SpotPoolModal />
      <DayPlanModal />
      <TripWizardModal />
      <SpotDetailModal />
      <SettingsModal />
    </div>
  )
}
