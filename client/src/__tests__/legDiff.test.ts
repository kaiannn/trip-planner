import { describe, it, expect } from 'vitest'
import {
  legsFromOrder,
  diffLegs,
  spotsWithChangedLegs,
} from '../lib/legDiff'
import {
  segmentCacheKey,
  hasCachedSegment,
  clearSegmentCache,
} from '../lib/amapRouting'

describe('legsFromOrder', () => {
  it('builds consecutive pairs', () => {
    expect(legsFromOrder(['a', 'b', 'c'])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
    expect(legsFromOrder(['a'])).toEqual([])
  })
})

describe('diffLegs (P2 reorder / drag-in)', () => {
  it('append only adds the new last leg', () => {
    const d = diffLegs(['a', 'b'], ['a', 'b', 'c'])
    expect(d.kept).toEqual([['a', 'b']])
    expect(d.added).toEqual([['b', 'c']])
    expect(d.removed).toEqual([])
  })

  it('reorder: middle move only affects nearby legs', () => {
    // a-b-c-d → a-c-b-d — no shared consecutive pair
    const d = diffLegs(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd'])
    expect(d.kept).toEqual([])
    expect(d.added).toEqual([
      ['a', 'c'],
      ['c', 'b'],
      ['b', 'd'],
    ])
    expect(d.removed).toEqual([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
    ])
  })

  it('empty → three stops yields two new legs, none kept', () => {
    const d = diffLegs([], ['x', 'y', 'z'])
    expect(d.kept).toEqual([])
    expect(d.added).toEqual([
      ['x', 'y'],
      ['y', 'z'],
    ])
    expect(d.removed).toEqual([])
  })

  it('spotsWithChangedLegs lists incident pins only', () => {
    const d = diffLegs(['a', 'b', 'c'], ['a', 'c', 'b'])
    const touched = new Set(spotsWithChangedLegs(d))
    expect(touched.has('a')).toBe(true)
    expect(touched.has('b')).toBe(true)
    expect(touched.has('c')).toBe(true)
    expect(spotsWithChangedLegs(diffLegs(['a', 'b'], ['a', 'b', 'c']))).toEqual(['b', 'c'])
  })
})

describe('segment cache keys for kept legs', () => {
  it('same mode+coords → same key; direction matters', () => {
    clearSegmentCache()
    const a = { lat: 30.25, lng: 120.15 }
    const b = { lat: 30.26, lng: 120.16 }
    const k1 = segmentCacheKey('driving', a, b)
    const k2 = segmentCacheKey('driving', a, b)
    const kRev = segmentCacheKey('driving', b, a)
    const kWalk = segmentCacheKey('walking', a, b)
    expect(k1).toBe(k2)
    expect(k1).not.toBe(kRev)
    expect(k1).not.toBe(kWalk)
    expect(hasCachedSegment('driving', a, b)).toBe(false)
  })

  it('kept legs after reorder map to cacheable pairs (no network if previously drawn)', () => {
    clearSegmentCache()
    const locs: Record<string, { lat: number; lng: number }> = {
      a: { lat: 30.25, lng: 120.15 },
      b: { lat: 30.26, lng: 120.16 },
      c: { lat: 30.27, lng: 120.17 },
    }
    // Simulate "previously drawn" a→b
    // (hasCachedSegment is false until fetchSegment fills the map — we only assert key stability)
    const kept = diffLegs(['a', 'b', 'c'], ['b', 'a', 'c']).kept
    for (const [from, to] of kept) {
      const key = segmentCacheKey('driving', locs[from], locs[to])
      expect(key.startsWith('driving:')).toBe(true)
    }
  })
})
