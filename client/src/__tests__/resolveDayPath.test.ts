import { describe, expect, it } from 'vitest'
import {
  allPlannedSpotIds,
  formatPathPreview,
  hasBranches,
  inactiveBranchSpotIds,
  resolveDaySpotOrder,
  branchGhostLegs,
} from '../lib/resolveDayPath'
import type { DailyPlan } from '../types'

const day = {
  spotOrder: ['a', 'b', 'c'],
  dayBranches: [
    { id: 'br1', when: 'rain', label: '下雨', spotOrder: ['a', 'museum', 'c'] },
    { id: 'br2', when: 'clear', label: '放晴', spotOrder: ['a', 'lake', 'b', 'c'] },
  ],
  activeBranchId: null,
} satisfies Partial<DailyPlan>

describe('resolveDayPath (day branches)', () => {
  it('default uses spotOrder', () => {
    expect(resolveDaySpotOrder(day)).toEqual(['a', 'b', 'c'])
  })

  it('active branch replaces full path', () => {
    expect(resolveDaySpotOrder({ ...day, activeBranchId: 'br1' })).toEqual([
      'a',
      'museum',
      'c',
    ])
  })

  it('allPlannedSpotIds includes branches', () => {
    expect([...allPlannedSpotIds(day)].sort()).toEqual([
      'a',
      'b',
      'c',
      'lake',
      'museum',
    ])
  })

  it('inactiveBranchSpotIds when default active', () => {
    expect([...inactiveBranchSpotIds(day)].sort()).toEqual(['lake', 'museum'])
  })

  it('hasBranches', () => {
    expect(hasBranches(day)).toBe(true)
    expect(hasBranches({ dayBranches: [] })).toBe(false)
  })

  it('formatPathPreview truncates', () => {
    const nameOf = (id: string) => id
    expect(formatPathPreview(['a', 'b'], nameOf)).toBe('a → b')
    expect(formatPathPreview(['1', '2', '3', '4', '5', '6'], nameOf, 3)).toBe(
      '1 → 2 → 3 → +3',
    )
  })

  it('branchGhostLegs skips active branch', () => {
    const loc = new Map([
      ['a', { lat: 0, lng: 0 }],
      ['museum', { lat: 1, lng: 1 }],
      ['c', { lat: 2, lng: 2 }],
      ['lake', { lat: 3, lng: 3 }],
      ['b', { lat: 4, lng: 4 }],
    ])
    const legs = branchGhostLegs({ ...day, activeBranchId: 'br1' }, loc)
    expect(legs.length).toBe(3) // a-lake, lake-b, b-c
  })
})
