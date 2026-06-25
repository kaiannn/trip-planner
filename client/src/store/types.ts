import type { UiState } from './slices/ui'
import type { TripCoreState } from './slices/tripCore'
import type { AiState } from './slices/ai'
import type { AmapPoiState } from './slices/amapPoi'
import type { QuizState } from './slices/quiz'
import type { UiActions } from './slices/ui'
import type { TripCoreActions } from './slices/tripCore'
import type { AiActions } from './slices/ai'
import type { AmapPoiActions } from './slices/amapPoi'
import type { QuizActions } from './slices/quiz'

export type FullState = UiState & TripCoreState & AiState & AmapPoiState & QuizState
export type FullActions = UiActions & TripCoreActions & AiActions & AmapPoiActions & QuizActions & {
  invalidateTrip: () => void
}
export type FullStore = FullState & FullActions

export type SetFn = (
  partial: Partial<FullState> | ((state: FullState) => Partial<FullState>),
) => void
export type GetFn = () => FullStore
