import { beforeEach, describe, expect, it, vi } from 'vitest'

const streamAiRecommend = vi.fn(async () => [])
const fetchAiRecommend = vi.fn(async () => [])
const fetchAiSeedPool = vi.fn(async () => [])
const fetchAiPoiCoarseFilter = vi.fn(async () => [])

vi.mock('../api/ai', () => ({
  abortPendingAiRequest: vi.fn(),
  fetchAiRecommend: () => fetchAiRecommend(),
  streamAiRecommend: () => streamAiRecommend(),
  fetchAiSeedPool: () => fetchAiSeedPool(),
  fetchAiPoiCoarseFilter: () => fetchAiPoiCoarseFilter(),
}))

vi.mock('../api/amap', () => ({
  fetchAmapPoiList: vi.fn(async () => []),
  fetchAmapPoiDetail: vi.fn(async () => null),
  fetchAmapPoiAround: vi.fn(async () => []),
  parseAmapLocation: vi.fn(() => null),
  pickPoiPhoto: vi.fn(() => undefined),
}))

import { useTripStore } from '../store'
import type { Spot } from '../types'

function sight(id: string): Spot {
  return {
    kind: 'sight',
    id,
    cityId: 'c1',
    name: id,
    location: { lat: 30.25 + Number(id.replace(/\D/g, '')) * 0.001, lng: 120.15 },
    visitMinutes: 90,
  } as Spot
}

describe('drag / reorder does not call LLM (P2)', () => {
  beforeEach(() => {
    streamAiRecommend.mockClear()
    fetchAiRecommend.mockClear()
    useTripStore.setState({
      cities: [{ id: 'c1', name: '杭州', order: 0 }],
      spots: [sight('s1'), sight('s2'), sight('s3')],
      dailyPlans: [
        { id: 'd1', dayIndex: 1, cityId: 'c1', lodging: {}, spotOrder: ['s1', 's2', 's3'] },
      ],
      aiDirty: false,
      aiStatus: '未请求',
      aiSections: [],
    })
  })

  it('setDaySpotOrder (reorder) only marks dirty', () => {
    useTripStore.getState().setDaySpotOrder('d1', ['s3', 's1', 's2'])
    const s = useTripStore.getState()
    expect(s.dailyPlans[0].spotOrder).toEqual(['s3', 's1', 's2'])
    expect(s.aiDirty).toBe(true)
    expect(streamAiRecommend).not.toHaveBeenCalled()
    expect(fetchAiRecommend).not.toHaveBeenCalled()
  })

  it('assignSpotToActivePath appends without LLM', () => {
    useTripStore.setState({ spots: [sight('s1'), sight('s2'), sight('s4')] })
    useTripStore.getState().assignSpotToActivePath('s4', 'd1')
    const order = useTripStore.getState().dailyPlans[0].spotOrder
    expect(order).toContain('s4')
    expect(order[0]).toBe('s1')
    expect(streamAiRecommend).not.toHaveBeenCalled()
  })

  it('moveSpotBetweenDays keeps other days and skips LLM', () => {
    useTripStore.setState({
      dailyPlans: [
        { id: 'd1', dayIndex: 1, cityId: 'c1', lodging: {}, spotOrder: ['s1', 's2'] },
        { id: 'd2', dayIndex: 2, cityId: 'c1', lodging: {}, spotOrder: [] },
      ],
    })
    useTripStore.getState().moveSpotBetweenDays('s2', 'd1', 'd2')
    const d1 = useTripStore.getState().dailyPlans.find((d) => d.id === 'd1')
    const d2 = useTripStore.getState().dailyPlans.find((d) => d.id === 'd2')
    expect(d1?.spotOrder).toEqual(['s1'])
    expect(d2?.spotOrder).toEqual(['s2'])
    expect(streamAiRecommend).not.toHaveBeenCalled()
    expect(useTripStore.getState().aiDirty).toBe(true)
  })

  it('requestAiRecommendations is the only path that hits the stream API', async () => {
    await useTripStore.getState().requestAiRecommendations('all')
    expect(streamAiRecommend).toHaveBeenCalledTimes(1)
  })
})
