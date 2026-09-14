import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../store/settingsStore'

vi.mock('../cycling/amapCycling', () => ({
  planRouteBookSegments: vi.fn(),
  searchNearbyPois: vi.fn(),
}))

import { planRouteBookSegments, searchNearbyPois } from '../cycling/amapCycling'
import { useCyclingStore } from '../cycling/store'
import type { CyclingNearbyPoi } from '../cycling/types'

const planMock = vi.mocked(planRouteBookSegments)
const searchMock = vi.mocked(searchNearbyPois)

function resetStore() {
  useCyclingStore.setState({
    open: false,
    title: '我的骑行路书',
    stops: [
      { id: 'start', kind: 'start', name: '起点', location: { lat: 30, lng: 120 } },
      { id: 'end', kind: 'end', name: '终点', location: { lat: 30.1, lng: 120.1 } },
    ],
    segments: [],
    plannedPath: [],
    totalDistance: 0,
    totalDurationSec: 0,
    avgSpeedKmh: 20,
    departTime: '08:00',
    notes: '',
    planning: false,
    planError: null,
    statusMsg: null,
    nearbyAnchorStopId: null,
    nearbyKind: 'supply',
    nearbyKeywords: '便利店',
    nearbyLoading: false,
    nearbyError: null,
    nearbyResults: [],
  })
}

describe('cycling store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
    useSettingsStore.setState({ amapWebServiceKey: 'test-key' })
  })

  it('planRoute succeeds and sums distances', async () => {
    planMock.mockResolvedValue({
      segments: [
        { fromId: 'start', toId: 'end', distance: 1200, duration: 300, path: [[120, 30], [120.1, 30.1]] },
      ],
      plannedPath: [[120, 30], [120.1, 30.1]],
      totalDistance: 1200,
      totalDurationSec: 300,
    })

    await useCyclingStore.getState().planRoute()

    const s = useCyclingStore.getState()
    expect(s.planning).toBe(false)
    expect(s.planError).toBeNull()
    expect(s.totalDistance).toBe(1200)
    expect(s.totalDurationSec).toBe(300)
    expect(s.segments).toHaveLength(1)
    expect(s.plannedPath).toEqual([[120, 30], [120.1, 30.1]])
    expect(s.statusMsg).toBe('路线已更新')
  })

  it('planRoute fails when endpoints lack coordinates', async () => {
    useCyclingStore.setState({
      stops: [
        { id: 'a', kind: 'start', name: '起点' },
        { id: 'b', kind: 'end', name: '终点' },
      ],
    })
    await useCyclingStore.getState().planRoute()
    expect(planMock).not.toHaveBeenCalled()
    expect(useCyclingStore.getState().planError).toContain('坐标')
  })

  it('planRoute records API error', async () => {
    planMock.mockRejectedValue(new Error('高德规划失败'))
    await useCyclingStore.getState().planRoute()
    expect(useCyclingStore.getState().planning).toBe(false)
    expect(useCyclingStore.getState().planError).toBe('高德规划失败')
  })

  it('cannot remove start/end stops', () => {
    useCyclingStore.getState().removeStop('start')
    useCyclingStore.getState().removeStop('end')
    expect(useCyclingStore.getState().stops.map((s) => s.id)).toEqual(['start', 'end'])
  })

  it('addStop inserts before end', () => {
    useCyclingStore.getState().addStop({ name: '中间', location: { lat: 30.05, lng: 120.05 } })
    const stops = useCyclingStore.getState().stops
    expect(stops).toHaveLength(3)
    expect(stops[1].name).toBe('中间')
    expect(stops[2].kind).toBe('end')
  })

  it('moveStop keeps start/end fixed', () => {
    useCyclingStore.getState().addStop({ name: 'A', location: { lat: 30.02, lng: 120.02 } })
    useCyclingStore.getState().addStop({ name: 'B', location: { lat: 30.03, lng: 120.03 } })
    const midId = useCyclingStore.getState().stops[1].id
    useCyclingStore.getState().moveStop('start', -1)
    useCyclingStore.getState().moveStop(midId, 1) // would hit end
    const stops = useCyclingStore.getState().stops
    expect(stops[0].kind).toBe('start')
    expect(stops[stops.length - 1].kind).toBe('end')
  })

  it('addNearbyAsStop inserts after anchor', () => {
    useCyclingStore.setState({
      nearbyAnchorStopId: 'start',
      nearbyKind: 'supply',
      nearbyResults: [],
    })
    const poi: CyclingNearbyPoi = {
      id: 'poi1',
      name: '全家便利店',
      address: '某路 1 号',
      location: { lat: 30.01, lng: 120.01 },
      distance: 230,
    }
    useCyclingStore.getState().addNearbyAsStop(poi)
    const stops = useCyclingStore.getState().stops
    expect(stops).toHaveLength(3)
    expect(stops[1].name).toBe('全家便利店')
    expect(stops[1].kind).toBe('supply')
    expect(stops[1].note).toContain('230')
    expect(useCyclingStore.getState().nearbyAnchorStopId).toBeNull()
  })

  it('searchNearby loads results', async () => {
    searchMock.mockResolvedValue([
      {
        id: 'p1',
        name: '7-11',
        location: { lat: 30, lng: 120 },
        distance: 100,
      },
    ])
    useCyclingStore.setState({ nearbyAnchorStopId: 'start' })
    await useCyclingStore.getState().searchNearby()
    expect(useCyclingStore.getState().nearbyResults).toHaveLength(1)
    expect(useCyclingStore.getState().nearbyLoading).toBe(false)
    expect(useCyclingStore.getState().nearbyError).toBeNull()
  })

  it('setField clamps avg speed', () => {
    useCyclingStore.getState().setField('avgSpeedKmh', 99)
    expect(useCyclingStore.getState().avgSpeedKmh).toBe(40)
    useCyclingStore.getState().setField('avgSpeedKmh', 1)
    expect(useCyclingStore.getState().avgSpeedKmh).toBe(5)
  })
})
