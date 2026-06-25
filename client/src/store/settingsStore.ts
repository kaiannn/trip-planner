import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  amapWebServiceKey: string
  settingsOpen: boolean
}

interface SettingsActions {
  setLlmApiKey: (v: string) => void
  setLlmBaseUrl: (v: string) => void
  setLlmModel: (v: string) => void
  setAmapWebServiceKey: (v: string) => void
  setSettingsOpen: (v: boolean) => void
  checkKeys: () => void
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      llmApiKey: '',
      llmBaseUrl: 'https://api.deepseek.com/v1',
      llmModel: 'deepseek-chat',
      amapWebServiceKey: '',
      settingsOpen: false,

      setLlmApiKey: (v) => set({ llmApiKey: v }),
      setLlmBaseUrl: (v) => set({ llmBaseUrl: v }),
      setLlmModel: (v) => set({ llmModel: v }),
      setAmapWebServiceKey: (v) => set({ amapWebServiceKey: v }),
      setSettingsOpen: (v) => set({ settingsOpen: v }),

      checkKeys: () => {
        if (!get().llmApiKey) set({ settingsOpen: true })
      },
    }),
    {
      name: 'trip-planner-settings',
      partialize: (state) => ({
        llmApiKey: state.llmApiKey,
        llmBaseUrl: state.llmBaseUrl,
        llmModel: state.llmModel,
        amapWebServiceKey: state.amapWebServiceKey,
      }),
    },
  ),
)
