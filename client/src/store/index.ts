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
import { parseVisitMinutes } from '../lib/visitTime'

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
      version: 4,
      migrate: (persistedState) => {
        try {
          const s = persistedState as
            | {
                spots?: Array<{
                  kind?: string
                  id?: string
                  visitTimeText?: string
                  visitMinutes?: number
                }>
                cities?: unknown[]
                dataSource?: 'empty' | 'demo' | 'user'
              }
            | undefined
          if (s?.spots?.length) {
            s.spots = s.spots.map((sp) => {
              let next = sp
              if (sp && typeof sp === 'object' && !('kind' in sp)) {
                next = { ...sp, kind: 'sight' }
              }
              // v4: backfill numeric stay minutes from free-text when missing
              if (
                next &&
                next.visitMinutes == null &&
                typeof next.visitTimeText === 'string'
              ) {
                const m = parseVisitMinutes(next.visitTimeText)
                if (m != null) next = { ...next, visitMinutes: m }
              }
              return next
            })
          }
          if (!s || typeof s !== 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { dataSource: 'empty' } as any
          }
          if (!s.dataSource) {
            const spots = s.spots ?? []
            const hasDemo = spots.some((sp) => String(sp?.id ?? '').startsWith('demo_'))
            s.dataSource = hasDemo
              ? 'demo'
              : spots.length || (s.cities?.length ?? 0)
                ? 'user'
                : 'empty'
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return s as any
        } catch (e) {
          // Never wipe user trips on a bad migration — keep raw state if possible.
          console.error('[persist] migrate failed, keeping raw state', e)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (persistedState ?? { dataSource: 'empty' }) as any
        }
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
        taskPace: state.taskPace,
        taskInterests: state.taskInterests,
        taskDays: state.taskDays,
        dataSource: state.dataSource,
      }),
    },
  ),
)
