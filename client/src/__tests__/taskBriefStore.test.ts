import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/ai', () => ({
  abortPendingAiRequest: vi.fn(),
  fetchAiRecommend: vi.fn(async () => []),
  streamAiRecommend: vi.fn(async () => []),
  fetchAiPoiCoarseFilter: vi.fn(async () => []),
}))

vi.mock('../api/amap', () => ({
  fetchAmapPoiList: vi.fn(async () => []),
  fetchAmapPoiDetail: vi.fn(async () => null),
  fetchAmapPoiAround: vi.fn(async () => []),
  parseAmapLocation: vi.fn(() => null),
  pickPoiPhoto: vi.fn(() => undefined),
}))

import { useTripStore } from '../store'
import { missingSlots } from '../lib/taskBrief'

describe('task brief store actions (P0.5)', () => {
  beforeEach(() => {
    useTripStore.setState({
      cities: [],
      spots: [],
      dailyPlans: [],
      tripStart: '',
      tripEnd: '',
      aiBudget: '',
      taskPace: '',
      taskInterests: [],
      taskDays: null,
      aiDirty: false,
      aiStatus: '未请求',
      aiSections: [],
      aiPromptText: '',
      aiRefreshTimer: null,
    })
  })

  it('getMissingSlots reflects empty trip', () => {
    const missing = useTripStore.getState().getMissingSlots()
    expect(missing).toEqual([
      'destination',
      'days',
      'budget',
      'pace',
      'interest_focus',
    ])
  })

  it('pace / interest / budget fill slots and mark dirty', () => {
    const s = useTripStore.getState()
    s.setTaskPace('relaxed')
    s.toggleTaskInterest('美食')
    s.setAiBudget('500')
    s.toggleTaskInterest('美食') // toggle off
    s.toggleTaskInterest('小众')

    const st = useTripStore.getState()
    expect(st.taskPace).toBe('relaxed')
    expect(st.taskInterests).toEqual(['小众'])
    expect(st.aiDirty).toBe(true)

    st.setAiBudget('') // avoid polluting later budget assertion path
    useTripStore.setState({
      cities: [{ id: 'c1', name: '成都', order: 0 }],
      tripStart: '2025-05-01',
      tripEnd: '2025-05-03',
    })
    const missing = useTripStore.getState().getMissingSlots()
    expect(missing).not.toContain('destination')
    expect(missing).not.toContain('days')
    expect(missing).not.toContain('pace')
    expect(missing).not.toContain('interest_focus')
    expect(missing).toContain('budget')
  })

  it('getTaskBrief builds from store fields', () => {
    useTripStore.setState({
      cities: [{ id: 'c1', name: '成都', order: 0 }],
      dailyPlans: [{ id: 'd1' } as never, { id: 'd2' } as never],
      aiBudget: '400',
      taskPace: 'moderate',
      taskInterests: ['美食'],
      taskDays: null,
    })
    const brief = useTripStore.getState().getTaskBrief()
    expect(brief.destination).toBe('成都')
    expect(brief.days).toBe(2)
    expect(brief.budgetPerDay).toBe(400)
    expect(brief.pace).toBe('moderate')
    expect(brief.interestFocus).toEqual(['美食'])
    expect(missingSlots(brief)).toEqual([])
  })
})
