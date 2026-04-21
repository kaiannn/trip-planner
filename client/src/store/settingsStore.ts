import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface KeyStatus {
  llm: boolean
  amap: boolean
}

interface SettingsState {
  llmApiKey: string
  amapKey: string
  settingsOpen: boolean
  serverKeyStatus: KeyStatus | null
}

interface SettingsActions {
  setLlmApiKey: (v: string) => void
  setAmapKey: (v: string) => void
  setSettingsOpen: (v: boolean) => void
  setServerKeyStatus: (s: KeyStatus) => void
  fetchServerKeyStatus: () => Promise<void>
  needsUserKeys: () => boolean
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      llmApiKey: '',
      amapKey: '',
      settingsOpen: false,
      serverKeyStatus: null,

      setLlmApiKey: (v) => set({ llmApiKey: v }),
      setAmapKey: (v) => set({ amapKey: v }),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      setServerKeyStatus: (s) => set({ serverKeyStatus: s }),

      fetchServerKeyStatus: async () => {
        try {
          const res = await fetch('/api/config/status')
          if (res.ok) {
            const data = await res.json()
            set({ serverKeyStatus: data })
            if (!data.llm && !get().llmApiKey) set({ settingsOpen: true })
            if (!data.amap && !get().amapKey) set({ settingsOpen: true })
          }
        } catch {
          // ignore
        }
      },

      needsUserKeys: () => {
        const s = get()
        const status = s.serverKeyStatus
        if (!status) return false
        const llmMissing = !status.llm && !s.llmApiKey
        const amapMissing = !status.amap && !s.amapKey
        return llmMissing || amapMissing
      },
    }),
    {
      name: 'trip-planner-settings',
      partialize: (state) => ({
        llmApiKey: state.llmApiKey,
        amapKey: state.amapKey,
      }),
    },
  ),
)

export function getUserHeaders(): Record<string, string> {
  const s = useSettingsStore.getState()
  const headers: Record<string, string> = {}
  if (s.llmApiKey) headers['x-llm-api-key'] = s.llmApiKey
  if (s.amapKey) headers['x-amap-key'] = s.amapKey
  return headers
}
