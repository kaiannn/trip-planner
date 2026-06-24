import { describe, it, expect } from 'vitest'
import { distanceInMeters, isDuplicateSpot } from '../lib/geo'

describe('distanceInMeters', () => {
  it('returns 0 for same point', () => {
    expect(distanceInMeters(30.25, 120.15, 30.25, 120.15)).toBe(0)
  })

  it('calculates known distance (Hangzhou West Lake area)', () => {
    // Two points ~1km apart in Hangzhou
    const d = distanceInMeters(30.2500, 120.1500, 30.2590, 120.1500)
    expect(d).toBeGreaterThan(900)
    expect(d).toBeLessThan(1100)
  })

  it('handles cross-hemisphere distances', () => {
    // Beijing to Shanghai ~1000-1200km
    const d = distanceInMeters(39.9, 116.4, 31.2, 121.5)
    expect(d).toBeGreaterThan(900_000)
    expect(d).toBeLessThan(1_300_000)
  })

  it('is symmetric', () => {
    const a = distanceInMeters(30.25, 120.15, 31.2, 121.5)
    const b = distanceInMeters(31.2, 121.5, 30.25, 120.15)
    expect(a).toBeCloseTo(b, 0)
  })
})

describe('isDuplicateSpot', () => {
  const spots = [
    { cityId: 'c1', name: '西湖', location: { lat: 30.25, lng: 120.15 } },
    { cityId: 'c1', name: '灵隐寺', location: { lat: 30.26, lng: 120.12 } },
    { cityId: 'c2', name: '外滩', location: { lat: 31.24, lng: 121.49 } },
  ]

  it('detects exact name match in same city', () => {
    expect(isDuplicateSpot(spots, 'c1', '西湖', 30.25, 120.15)).toBe(true)
  })

  it('detects case-insensitive name match', () => {
    expect(isDuplicateSpot(spots, 'c1', '西湖 ', 30.25, 120.15)).toBe(true)
  })

  it('detects proximity match (< 100m)', () => {
    expect(isDuplicateSpot(spots, 'c1', '新景点', 30.25005, 120.15005)).toBe(true)
  })

  it('rejects different name + distant location', () => {
    expect(isDuplicateSpot(spots, 'c1', '宋城', 30.20, 120.10)).toBe(false)
  })

  it('ignores same name in different city', () => {
    expect(isDuplicateSpot(spots, 'c2', '西湖', 30.25, 120.15)).toBe(false)
  })

  it('handles empty spots array', () => {
    expect(isDuplicateSpot([], 'c1', '西湖', 30.25, 120.15)).toBe(false)
  })
})
