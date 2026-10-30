import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock LLM/AMap network layers so store actions never hit fetch.
vi.mock('../api/ai', () => ({
  abortPendingAiRequest: vi.fn(),
  fetchAiRecommend: vi.fn(async () => []),
  streamAiRecommend: vi.fn(async () => []),
  fetchAiSeedPool: vi.fn(async () => []),
}))

vi.mock('../api/amap', () => ({
  fetchAmapPoiList: vi.fn(async () => []),
  fetchAmapPoiDetail: vi.fn(async () => null),
  pickPoiPhoto: vi.fn(() => undefined),
}))

import { useTripStore } from '../store'

describe('aiDirty / scheduleAiRefresh (P0 cost control)', () => {
  beforeEach(() => {
    const s = useTripStore.getState()
    useTripStore.setState({
      aiDirty: false,
      aiStatus: '未请求',
      aiSections: [],
      aiPromptText: '',
      aiRefreshTimer: null,
      aiSeedInput: '',
      aiSeedStatus: '',
      cities: [],
      spots: [],
      dailyPlans: [],
    })
    // silence trip side effects if any
    void s
  })

  it('marks dirty without calling LLM', () => {
    useTripStore.getState().scheduleAiRefresh()
    const after = useTripStore.getState()
    expect(after.aiDirty).toBe(true)
    expect(after.aiStatus).toContain('不会自动请求 AI')
  })

  it('keeps previous sections visible and notes they are stale', () => {
    useTripStore.setState({
      aiSections: [{ id: 'a', title: 't', type: 'spots', items: [] }],
      aiDirty: false,
    })
    useTripStore.getState().scheduleAiRefresh()
    const after = useTripStore.getState()
    expect(after.aiDirty).toBe(true)
    expect(after.aiSections.length).toBe(1)
    expect(after.aiStatus).toContain('上一次结果')
  })

  it('requestAiRecommendations clears dirty when a city exists', async () => {
    useTripStore.setState({
      aiDirty: true,
      cities: [
        {
          id: 'c1',
          name: '杭州',
          order: 0,
          location: { lat: 30, lng: 120 },
        },
      ],
    })
    // streamAiRecommend mock returns [] — still a full request path
    await useTripStore.getState().requestAiRecommendations('all')
    expect(useTripStore.getState().aiDirty).toBe(false)
  })
})
