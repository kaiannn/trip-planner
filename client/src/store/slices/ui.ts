import type { Spot } from '../../types'
import type { SetFn } from '../types'

export interface UiState {
  spotPoolOpen: boolean
  dayPlanOpen: boolean
  dayPlanEditDayId: string | null
  tripWizardOpen: boolean
  spotDetailSpot: Spot | null
  poolCityFilter: string
  pendingMapCoords: { lat: number; lng: number } | null
  pendingMapSuggestedName: string | null
  pendingMapSuggestedAddress: string | null
  mapFocusDayId: string | null
  mapFocusSpotId: string | null
  mapRedrawNonce: number
}

export interface UiActions {
  setSpotPoolOpen: (v: boolean) => void
  setDayPlanOpen: (v: boolean) => void
  openDayPlanFor: (dayId: string) => void
  setTripWizardOpen: (v: boolean) => void
  setSpotDetail: (s: Spot | null) => void
  setPoolCityFilter: (v: string) => void
  setPendingMapCoords: (c: { lat: number; lng: number } | null) => void
  setPendingMapSuggestion: (name: string | null, address: string | null) => void
  setMapFocusDayId: (id: string | null) => void
  setMapFocusSpotId: (id: string | null) => void
  clearMapFocus: () => void
  bumpMapRedraw: () => void
}

export const initialUiState: UiState = {
  spotPoolOpen: false,
  dayPlanOpen: false,
  dayPlanEditDayId: null,
  tripWizardOpen: false,
  spotDetailSpot: null,
  poolCityFilter: '',
  pendingMapCoords: null,
  pendingMapSuggestedName: null,
  pendingMapSuggestedAddress: null,
  mapFocusDayId: null,
  mapFocusSpotId: null,
  mapRedrawNonce: 0,
}

export function createUiActions(set: SetFn): UiActions {
  return {
    setSpotPoolOpen: (v) => set({ spotPoolOpen: v }),
    setDayPlanOpen: (v) =>
      set({ dayPlanOpen: v, ...(v ? {} : { dayPlanEditDayId: null }) }),
    openDayPlanFor: (dayId) =>
      set({ dayPlanOpen: true, dayPlanEditDayId: dayId }),
    setTripWizardOpen: (v) => set({ tripWizardOpen: v }),
    setSpotDetail: (spot) => set({ spotDetailSpot: spot }),
    setPoolCityFilter: (v) => set({ poolCityFilter: v }),
    setPendingMapCoords: (c) =>
      set({
        pendingMapCoords: c,
        pendingMapSuggestedName: null,
        pendingMapSuggestedAddress: null,
      }),
    setPendingMapSuggestion: (name, address) =>
      set({ pendingMapSuggestedName: name, pendingMapSuggestedAddress: address }),
    setMapFocusDayId: (id) => set({ mapFocusDayId: id, mapFocusSpotId: null }),
    setMapFocusSpotId: (id) => set({ mapFocusSpotId: id, mapFocusDayId: null }),
    clearMapFocus: () => set({ mapFocusDayId: null, mapFocusSpotId: null }),
    bumpMapRedraw: () => set((s) => ({ mapRedrawNonce: s.mapRedrawNonce + 1 })),
  }
}
