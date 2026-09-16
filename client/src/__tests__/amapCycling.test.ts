import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../store/settingsStore'
import {
  planRidingSegment,
  planRouteBookSegments,
  searchNearbyPois,
} from '../cycling/amapCycling'

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response
}

describe('amapCycling', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    useSettingsStore.setState({ amapWebServiceKey: 'test-key' })
  })

  it('requires web service key', async () => {
    vi.stubEnv('VITE_AMAP_WEBSERVICE_KEY', '')
    useSettingsStore.setState({ amapWebServiceKey: '' })
    await expect(
      planRidingSegment({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }),
    ).rejects.toThrow(/Web 服务 Key/)
  })

  it('parses v4 bicycling path into segment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        errcode: 0,
        data: {
          paths: [
            {
              distance: 1500,
              duration: 400,
              steps: [
                { polyline: '120.000000,30.000000;120.010000,30.010000' },
                { polyline: '120.010000,30.010000;120.020000,30.020000' },
              ],
            },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const seg = await planRidingSegment(
      { lat: 30, lng: 120 },
      { lat: 30.02, lng: 120.02 },
    )
    expect(seg.distance).toBe(1500)
    expect(seg.duration).toBe(400)
    expect(seg.path[0]).toEqual([120, 30])
    expect(seg.path[seg.path.length - 1]).toEqual([120.02, 30.02])
    // duplicate join point collapsed
    expect(seg.path).toHaveLength(3)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v4/direction/bicycling')
  })

  it('falls back to v3 riding when v4 fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errcode: 40001, errdetail: 'bad' }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: '1',
          route: {
            paths: [
              {
                distance: 800,
                time: 200,
                steps: [{ polyline: '120.0,30.0;120.005,30.005' }],
              },
            ],
          },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const seg = await planRidingSegment(
      { lat: 30, lng: 120 },
      { lat: 30.005, lng: 120.005 },
    )
    expect(seg.distance).toBe(800)
    expect(seg.duration).toBe(200)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/v3/direction/riding')
  })

  it('planRouteBookSegments chains stops and dedupes path joints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          data: {
            paths: [
              {
                distance: 100,
                duration: 50,
                steps: [{ polyline: '120,30;120.01,30.01' }],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          data: {
            paths: [
              {
                distance: 200,
                duration: 80,
                steps: [{ polyline: '120.01,30.01;120.02,30.02' }],
              },
            ],
          },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await planRouteBookSegments([
      { id: 'a', location: { lat: 30, lng: 120 } },
      { id: 'b', location: { lat: 30.01, lng: 120.01 } },
      { id: 'c', location: { lat: 30.02, lng: 120.02 } },
    ])

    expect(result.segments).toHaveLength(2)
    expect(result.segments[0].fromId).toBe('a')
    expect(result.segments[1].toId).toBe('c')
    expect(result.totalDistance).toBe(300)
    expect(result.totalDurationSec).toBe(130)
    expect(result.plannedPath).toEqual([
      [120, 30],
      [120.01, 30.01],
      [120.02, 30.02],
    ])
  })

  it('planRouteBookSegments rejects <2 stops', async () => {
    await expect(
      planRouteBookSegments([{ id: 'a', location: { lat: 1, lng: 2 } }]),
    ).rejects.toThrow(/至少/)
  })

  it('searchNearbyPois maps around results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: '1',
        pois: [
          {
            id: 'B001',
            name: '便利店A',
            address: 'xx路',
            location: '120.1,30.1',
            distance: 120,
          },
          { id: 'B002', name: '无坐标', location: '' },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const list = await searchNearbyPois({
      location: { lat: 30, lng: 120 },
      keywords: '便利店',
    })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'B001',
      name: '便利店A',
      distance: 120,
      location: { lat: 30.1, lng: 120.1 },
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain('place/around')
  })
})
