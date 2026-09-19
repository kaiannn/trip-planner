import { describe, expect, it } from 'vitest'
import {
  addMinutesToTime,
  buildCyclingMarkdown,
  clampAvgSpeed,
  estimateDurationSec,
  formatDuration,
  formatKm,
  hasLocatedEndpoints,
  locatedStops,
  parseDepartTime,
  resolveSpeedDraft,
  sumSegmentDistance,
} from '../cycling/routeMath'
import type { CyclingSegment, CyclingStop } from '../cycling/types'

const stop = (id: string, kind: CyclingStop['kind'], loc?: { lat: number; lng: number }): CyclingStop => ({
  id,
  kind,
  name: id,
  location: loc,
})

describe('routeMath', () => {
  it('formatKm', () => {
    expect(formatKm(1500)).toBe('1.50 km')
    expect(formatKm(12345)).toBe('12.3 km')
    expect(formatKm(-1)).toBe('—')
  })

  it('formatDuration', () => {
    expect(formatDuration(1800)).toBe('30 分钟')
    expect(formatDuration(3600)).toBe('1 小时')
    expect(formatDuration(5400)).toBe('1 小时 30 分')
  })

  it('estimateDurationSec uses avg speed', () => {
    // 20km @ 20km/h = 1h
    expect(estimateDurationSec(20000, 20)).toBeCloseTo(3600, 5)
    // invalid speed falls back to 20
    expect(estimateDurationSec(20000, 0)).toBeCloseTo(3600, 5)
  })

  it('parseDepartTime / addMinutesToTime', () => {
    expect(parseDepartTime('08:30')).toEqual({ h: 8, m: 30 })
    expect(parseDepartTime('25:00')).toBeNull()
    expect(addMinutesToTime('08:00', 90)).toBe('09:30')
    expect(addMinutesToTime('23:30', 60)).toBe('00:30')
  })

  it('locatedStops / hasLocatedEndpoints', () => {
    const stops = [
      stop('a', 'start', { lat: 1, lng: 2 }),
      stop('b', 'checkpoint'),
      stop('c', 'end', { lat: 3, lng: 4 }),
    ]
    expect(hasLocatedEndpoints(stops)).toBe(true)
    expect(locatedStops(stops).map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('sumSegmentDistance', () => {
    const segs = [
      { fromId: 'a', toId: 'b', distance: 1000, duration: 60, path: [] },
      { fromId: 'b', toId: 'c', distance: 2500, duration: 120, path: [] },
    ] satisfies CyclingSegment[]
    expect(sumSegmentDistance(segs)).toBe(3500)
  })

  it('buildCyclingMarkdown includes stops and segments', () => {
    const md = buildCyclingMarkdown({
      title: '测试路书',
      stops: [
        stop('a', 'start', { lat: 1, lng: 2 }),
        stop('b', 'supply', { lat: 3, lng: 4 }),
        stop('c', 'end', { lat: 5, lng: 6 }),
      ],
      segments: [
        { fromId: 'a', toId: 'b', distance: 5000, duration: 900, path: [] },
        { fromId: 'b', toId: 'c', distance: 10000, duration: 1800, path: [] },
      ],
      totalDistance: 15000,
      avgSpeedKmh: 20,
      departTime: '08:00',
      notes: '注意补水',
    })
    expect(md).toContain('# 测试路书')
    expect(md).toContain('15.0 km')
    expect(md).toContain('注意补水')
    expect(md).toContain('| 2 |')
    expect(md).toContain('5.00 km')
  })

  it('clampAvgSpeed', () => {
    expect(clampAvgSpeed(100)).toBe(40)
    expect(clampAvgSpeed(1)).toBe(5)
    expect(clampAvgSpeed(18.4)).toBe(18.4)
  })

  it('resolveSpeedDraft keeps intermediate typing states', () => {
    expect(resolveSpeedDraft('2', 20)).toBe(2)
    expect(resolveSpeedDraft('2.', 20)).toBe(2)
    expect(resolveSpeedDraft('25', 20)).toBe(25)
    expect(resolveSpeedDraft('15.5', 20)).toBe(15.5)
  })

  it('resolveSpeedDraft falls back on empty or invalid drafts', () => {
    expect(resolveSpeedDraft('', 20)).toBe(20)
    expect(resolveSpeedDraft('   ', 20)).toBe(20)
    expect(resolveSpeedDraft('-', 20)).toBe(20)
    expect(resolveSpeedDraft('.', 20)).toBe(20)
    expect(resolveSpeedDraft('abc', 20)).toBe(20)
  })
})
