import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FullStore } from './types'
import { initialUiState, createUiActions } from './slices/ui'
import { initialTripCoreState, createTripCoreActions } from './slices/tripCore'
import { initialAiState, createAiActions } from './slices/ai'
import { initialAmapPoiState, createAmapPoiActions } from './slices/amapPoi'
import { initialQuizState, createQuizActions } from './slices/quiz'
import { useLogStore } from './logStore'
import type { LogEntry } from '../types'

export type { FullStore }

type StoreWithLogs = FullStore & {
  logs: LogEntry[]
  pushLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}

export const useTripStore = create<StoreWithLogs>()(
  persist(
    (set, get) => ({
      ...initialUiState,
      ...initialTripCoreState,
      ...initialAiState,
      ...initialAmapPoiState,
      ...initialQuizState,
      ...createUiActions(set as never),
      ...createTripCoreActions(set as never, get as never),
      ...createAiActions(set as never, get as never),
      ...createAmapPoiActions(set as never, get as never),
      ...createQuizActions(set as never, get as never),
      invalidateTrip: () => {
        get().bumpMapRedraw()
        get().scheduleAiRefresh()
      },
      // Delegate to standalone logStore so slices can call pushLog without circular deps
      get logs() { return useLogStore.getState().logs },
      pushLog: (message: string, level?: 'info' | 'warn' | 'error') =>
        useLogStore.getState().pushLog(message, level),
    }),
    {
      name: 'trip-planner-storage',
      version: 2,
      migrate: (persistedState) => {
        const s = persistedState as
          | { spots?: Array<{ kind?: string }> }
          | undefined
        if (s?.spots?.length) {
          s.spots = s.spots.map((sp) =>
            sp && typeof sp === 'object' && !('kind' in sp)
              ? { ...sp, kind: 'sight' }
              : sp,
          )
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return s as any
      },
      partialize: (state) => ({
        cities: state.cities,
        spots: state.spots,
        dailyPlans: state.dailyPlans,
        tripTitle: state.tripTitle,
        tripStart: state.tripStart,
        tripEnd: state.tripEnd,
        tripExpectation: state.tripExpectation,
        tripType: state.tripType,
        aiCityId: state.aiCityId,
        aiBudget: state.aiBudget,
        appMode: state.appMode,
      }),
    },
  ),
)
