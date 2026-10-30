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
import type { Spot } from '../types'

function sight(id: string, over: Partial<Spot> = {}): Spot {
  return {
    kind: 'sight',
    id,
    cityId: 'c1',
    name: id,
    location: { lat: 30.25, lng: 120.15 },
    visitMinutes: 90,
    ...over,
  } as Spot
}

describe('packUnassignedSpots (P1.5)', () => {
  beforeEach(() => {
    useTripStore.setState({
      cities: [{ id: 'c1', name: '杭州', order: 0, location: { lat: 30.25, lng: 120.15 } }],
      spots: [],
      dailyPlans: [
        {
          id: 'd1',
          dayIndex: 1,
          cityId: 'c1',
          lodging: {},
          spotOrder: [],
        },
        {
          id: 'd2',
          dayIndex: 2,
          cityId: 'c1',
          lodging: {},
          spotOrder: [],
        },
      ],
      taskPace: 'packed',
      aiDirty: false,
    })
  })

  it('packs unassigned sights into empty days and backfills visitMinutes', () => {
    useTripStore.setState({
      spots: [
        sight('a', { visitMinutes: undefined, visitTimeText: '2小时' }),
        sight('b', { visitMinutes: 90 }),
        sight('c', { visitMinutes: 90 }),
      ],
    })
    const result = useTripStore.getState().packUnassignedSpots()
    expect(result.daysTouched).toBeGreaterThan(0)
    const plans = useTripStore.getState().dailyPlans
    const all = plans.flatMap((d) => d.spotOrder)
    expect(all).toContain('a')
    expect(all).toContain('b')
    // visitTimeText「2小时」backfilled to 120
    const a = useTripStore.getState().spots.find((s) => s.id === 'a')
    expect(a?.visitMinutes).toBe(120)
  })

  it('keeps existing spotOrder prefix', () => {
    useTripStore.setState({
      spots: [sight('keep'), sight('extra')],
      dailyPlans: [
        { id: 'd1', dayIndex: 1, cityId: 'c1', lodging: {}, spotOrder: ['keep'] },
      ],
    })
    useTripStore.getState().packUnassignedSpots()
    const d1 = useTripStore.getState().dailyPlans.find((d) => d.id === 'd1')
    expect(d1?.spotOrder[0]).toBe('keep')
    expect(d1?.spotOrder).toContain('extra')
  })

  it('no-ops when pool empty', () => {
    useTripStore.setState({ spots: [sight('onDay')] })
    useTripStore.setState({
      dailyPlans: [
        { id: 'd1', dayIndex: 1, cityId: 'c1', lodging: {}, spotOrder: ['onDay'] },
      ],
    })
    const result = useTripStore.getState().packUnassignedSpots()
    expect(result.packed).toBe(0)
    expect(result.daysTouched).toBe(0)
  })
})
