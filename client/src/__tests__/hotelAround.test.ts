import { beforeEach, describe, expect, it, vi } from 'vitest'

const coarseFilter = vi.fn(async () => ['p2', 'p1'])

vi.mock('../api/ai', () => ({
  abortPendingAiRequest: vi.fn(),
  fetchAiRecommend: vi.fn(async () => []),
  streamAiRecommend: vi.fn(async () => []),
  fetchAiPoiCoarseFilter: () => coarseFilter(),
}))

const aroundMock = vi.fn(async () => [
  {
    id: 'p1',
    name: '河坊街',
    location: '120.151,30.241',
    type: '风景名胜',
    rating: '4.5',
  },
  {
    id: 'p2',
    name: '知味观',
    location: '120.152,30.242',
    type: '餐饮服务',
    rating: '4.6',
  },
  {
    id: 'p3',
    name: '某酒店分店',
    location: '120.153,30.243',
    type: '住宿服务;酒店',
    rating: '4.0',
  },
])

vi.mock('../api/amap', () => ({
  fetchAmapPoiList: vi.fn(async () => []),
  fetchAmapPoiDetail: vi.fn(async () => null),
  fetchAmapPoiAround: () => aroundMock(),
  parseAmapLocation: vi.fn((loc?: string) => {
    if (!loc) return null
    const [lng, lat] = loc.split(',').map(Number)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }),
  pickPoiPhoto: vi.fn(() => undefined),
}))

import { useTripStore } from '../store'
import type { Spot } from '../types'

const hotel: Spot = {
  kind: 'hotel',
  id: 'h1',
  cityId: 'c1',
  name: '西湖边酒店',
  location: { lat: 30.24, lng: 120.15 },
  price: '¥400',
}

describe('fetchHotelAround / addSelectedHotelAround (L1)', () => {
  beforeEach(() => {
    aroundMock.mockClear()
    coarseFilter.mockClear()
    useTripStore.setState({
      cities: [{ id: 'c1', name: '杭州', order: 0 }],
      spots: [hotel],
      dailyPlans: [],
      taskInterests: ['美食'],
      taskPace: 'relaxed',
      aiBudget: '300',
      hotelAroundHotelId: null,
      hotelAroundStatus: '',
      hotelAroundPois: [],
      hotelAroundKeepIds: null,
      hotelAroundSelected: [],
      aiDirty: false,
    })
  })

  it('recalls around hotel, drops nested hotels, applies keep order', async () => {
    await useTripStore.getState().fetchHotelAround('h1')
    const st = useTripStore.getState()
    expect(aroundMock).toHaveBeenCalledTimes(1)
    expect(coarseFilter).toHaveBeenCalledTimes(1)
    // hotel-type p3 filtered out; keepIds order p2, p1
    expect(st.hotelAroundPois.map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(st.hotelAroundSelected.length).toBeGreaterThan(0)
    expect(st.hotelAroundKeepIds).toEqual(['p2', 'p1'])
  })

  it('addSelectedHotelAround converts kinds and appends to pool', async () => {
    await useTripStore.getState().fetchHotelAround('h1')
    const n = useTripStore.getState().addSelectedHotelAround()
    expect(n).toBe(2)
    const spots = useTripStore.getState().spots
    const added = spots.filter((s) => s.id !== 'h1')
    expect(added.map((s) => s.name).sort()).toEqual(['河坊街', '知味观'])
    expect(added.find((s) => s.name === '知味观')?.kind).toBe('restaurant')
    expect(added.find((s) => s.name === '河坊街')?.kind).toBe('sight')
    expect(useTripStore.getState().aiDirty).toBe(true)
  })

  it('clearHotelAround resets panel state', async () => {
    await useTripStore.getState().fetchHotelAround('h1')
    useTripStore.getState().clearHotelAround()
    expect(useTripStore.getState().hotelAroundPois).toEqual([])
    expect(useTripStore.getState().hotelAroundHotelId).toBeNull()
  })
})
