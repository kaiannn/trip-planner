import { describe, it, expect } from 'vitest'
import { parseVisitMinutes, effectiveVisitMinutes } from '../lib/visitTime'
import {
  packSpotsIntoDays,
  DAY_CAPACITY_BY_PACE,
  type PackableSpot,
} from '../lib/dayPack'

describe('parseVisitMinutes', () => {
  it('parses hour forms', () => {
    expect(parseVisitMinutes('2小时')).toBe(120)
    expect(parseVisitMinutes('1.5 小时')).toBe(90)
    expect(parseVisitMinutes('2h')).toBe(120)
  })

  it('parses range as midpoint', () => {
    expect(parseVisitMinutes('2-3小时')).toBe(150)
    expect(parseVisitMinutes('1~2小时')).toBe(90)
  })

  it('parses minutes', () => {
    expect(parseVisitMinutes('90分钟')).toBe(90)
    expect(parseVisitMinutes('45min')).toBe(45)
  })

  it('parses half / full day', () => {
    expect(parseVisitMinutes('半天')).toBe(240)
    expect(parseVisitMinutes('一整天')).toBe(480)
    expect(parseVisitMinutes('全天')).toBe(480)
  })

  it('bare number heuristics', () => {
    expect(parseVisitMinutes('2')).toBe(120)
    expect(parseVisitMinutes('90')).toBe(90)
  })

  it('returns null for junk', () => {
    expect(parseVisitMinutes('')).toBeNull()
    expect(parseVisitMinutes(undefined)).toBeNull()
    expect(parseVisitMinutes('随便逛逛')).toBeNull()
  })
})

describe('effectiveVisitMinutes', () => {
  it('prefers numeric field', () => {
    expect(
      effectiveVisitMinutes({ visitMinutes: 45, visitTimeText: '3小时' }),
    ).toBe(45)
  })

  it('falls back to text then default', () => {
    expect(effectiveVisitMinutes({ visitTimeText: '2小时' })).toBe(120)
    expect(effectiveVisitMinutes({ kind: 'sight' })).toBe(90)
    expect(effectiveVisitMinutes({ kind: 'restaurant' })).toBe(60)
  })
})

function spot(id: string, over: Partial<PackableSpot> = {}): PackableSpot {
  return {
    id,
    cityId: 'c1',
    name: id,
    location: { lat: 30.25, lng: 120.15 },
    kind: 'sight',
    visitMinutes: 90,
    ...over,
  }
}

describe('packSpotsIntoDays', () => {
  it('fills early days first within capacity, leaves overflow leftover', () => {
    // capacity 200 → 2 spots of 90 fit day1 (180), day2 gets rest
    const spots = ['a', 'b', 'c', 'd'].map((id) => spot(id, { visitMinutes: 90 }))
    const result = packSpotsIntoDays(
      [
        { dayId: 'd1', dayIndex: 1, cityId: 'c1', existing: [] },
        { dayId: 'd2', dayIndex: 2, cityId: 'c1', existing: [] },
      ],
      spots,
      { dayCapacityMinutes: 200 },
    )
    expect(result.dayOrders.d1).toHaveLength(2)
    expect(result.dayOrders.d2).toHaveLength(2)
    expect(result.leftoverIds).toEqual([])
  })

  it('keeps existing order and appends', () => {
    const existing = spot('keep')
    const result = packSpotsIntoDays(
      [{ dayId: 'd1', dayIndex: 1, cityId: 'c1', existing: [existing] }],
      [spot('new1')],
      { dayCapacityMinutes: 400 },
    )
    expect(result.dayOrders.d1[0]).toBe('keep')
    expect(result.dayOrders.d1).toContain('new1')
  })

  it('skips other cities', () => {
    const result = packSpotsIntoDays(
      [{ dayId: 'd1', dayIndex: 1, cityId: 'c1', existing: [] }],
      [spot('other', { cityId: 'c2' })],
      { dayCapacityMinutes: 400 },
    )
    expect(result.dayOrders.d1).toEqual([])
    expect(result.leftoverIds).toEqual(['other'])
  })

  it('does not pack hotels by default', () => {
    const result = packSpotsIntoDays(
      [{ dayId: 'd1', dayIndex: 1, cityId: 'c1', existing: [] }],
      [spot('h', { kind: 'hotel' })],
      { dayCapacityMinutes: 400 },
    )
    expect(result.dayOrders.d1).toEqual([])
  })

  it('respects pace capacity', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
      spot(id, { visitMinutes: 120 }),
    )
    const result = packSpotsIntoDays(
      [{ dayId: 'd1', dayIndex: 1, cityId: 'c1', existing: [] }],
      many,
      { pace: 'relaxed' }, // 300 → at most 2×120
    )
    expect(result.dayOrders.d1.length).toBeLessThanOrEqual(2)
    expect(result.leftoverIds.length).toBeGreaterThan(0)
  })

  it('uses DAY_CAPACITY_BY_PACE for packed', () => {
    expect(DAY_CAPACITY_BY_PACE.packed).toBe(540)
  })
})
