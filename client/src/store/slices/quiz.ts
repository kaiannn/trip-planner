import { buildTripProfileFromTags } from '../../lib/tripProfile'
import { useLogStore } from '../logStore'
import type { SetFn, GetFn } from '../types'

export interface QuizState {
  tripQuizPath: string[]
  tripQuizTags: string[]
  quizNodeId: string
  quizPhase: 'question' | 'result'
}

export interface QuizActions {
  resetQuiz: () => void
  setQuizNode: (id: string) => void
  selectQuizOption: (tags: string[], nextId: string | null) => void
  quizGoPrev: () => void
  quizBackFromResult: () => void
  appendExpectationFromQuiz: () => void
}

export const initialQuizState: QuizState = {
  tripQuizPath: [],
  tripQuizTags: [],
  quizNodeId: 'q_length',
  quizPhase: 'question',
}

export function createQuizActions(set: SetFn, get: GetFn): QuizActions {
  return {
    resetQuiz: () =>
      set({ tripQuizPath: ['q_length'], tripQuizTags: [], quizNodeId: 'q_length', quizPhase: 'question' }),

    setQuizNode: (id) => {
      set((s) => {
        let path = [...s.tripQuizPath]
        if (!path.length) path = [id]
        else if (path[path.length - 1] !== id) path = [...path, id]
        return { quizNodeId: id, tripQuizPath: path }
      })
    },

    selectQuizOption: (tags, nextId) => {
      set((s) => ({ tripQuizTags: [...s.tripQuizTags, ...tags] }))
      if (nextId) { get().setQuizNode(nextId) } else { set({ quizPhase: 'result' }) }
    },

    quizGoPrev: () => {
      const s = get()
      if (s.tripQuizPath.length <= 1) return
      const path = s.tripQuizPath.slice(0, -1)
      set({ tripQuizPath: path, quizNodeId: path[path.length - 1], quizPhase: 'question' })
    },

    quizBackFromResult: () => {
      set((s) => ({ tripQuizTags: s.tripQuizTags.slice(0, -1), quizNodeId: 'q_food', quizPhase: 'question' }))
    },

    appendExpectationFromQuiz: () => {
      const tags = get().tripQuizTags
      const profile = buildTripProfileFromTags(tags)
      if (!profile) { useLogStore.getState().pushLog('请先完成几道题。', 'error'); return }
      const marker = '【旅行性格测验画像】'
      const block = `${marker}${profile.summary}`
      const current = get().tripExpectation.trim()
      get().setTripField('tripExpectation', current ? `${current}\n\n${block}` : block)
      useLogStore.getState().pushLog('已根据测验结果生成旅行画像，并写入「旅行期望」。')
    },
  }
}
