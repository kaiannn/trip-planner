import { describe, it, expect } from 'vitest'
import { SPOT_KIND_LABEL, SPOT_KIND_ICON, SPOT_KIND_COLOR, spotKind, isSight, isHotel, isRestaurant } from '../lib/spotKind'

describe('SPOT_KIND_LABEL', () => {
  it('has labels for all three kinds', () => {
    expect(SPOT_KIND_LABEL.sight).toBe('景点')
    expect(SPOT_KIND_LABEL.hotel).toBe('酒店')
    expect(SPOT_KIND_LABEL.restaurant).toBe('餐厅')
  })
})

describe('SPOT_KIND_ICON', () => {
  it('has icons for all three kinds', () => {
    expect(SPOT_KIND_ICON.sight).toBeTruthy()
    expect(SPOT_KIND_ICON.hotel).toBeTruthy()
    expect(SPOT_KIND_ICON.restaurant).toBeTruthy()
  })
})

describe('SPOT_KIND_COLOR', () => {
  it('has hex colors for all three kinds', () => {
    expect(SPOT_KIND_COLOR.sight).toMatch(/^#[0-9a-f]{6}$/)
    expect(SPOT_KIND_COLOR.hotel).toMatch(/^#[0-9a-f]{6}$/)
    expect(SPOT_KIND_COLOR.restaurant).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('spotKind', () => {
  it('returns sight for undefined', () => {
    expect(spotKind(undefined)).toBe('sight')
  })

  it('returns sight for missing kind', () => {
    expect(spotKind({} as never)).toBe('sight')
  })

  it('returns hotel for hotel kind', () => {
    expect(spotKind({ kind: 'hotel' } as never)).toBe('hotel')
  })

  it('returns restaurant for restaurant kind', () => {
    expect(spotKind({ kind: 'restaurant' } as never)).toBe('restaurant')
  })

  it('returns sight for unknown kind', () => {
    expect(spotKind({ kind: 'unknown' } as never)).toBe('sight')
  })
})

describe('type guards', () => {
  const sight = { id: '1', kind: 'sight' as const, cityId: 'c1', name: 'test', location: { lat: 0, lng: 0 } }
  const hotel = { id: '2', kind: 'hotel' as const, cityId: 'c1', name: 'test', location: { lat: 0, lng: 0 } }
  const restaurant = { id: '3', kind: 'restaurant' as const, cityId: 'c1', name: 'test', location: { lat: 0, lng: 0 } }

  it('isSight works', () => {
    expect(isSight(sight)).toBe(true)
    expect(isSight(hotel)).toBe(false)
  })

  it('isHotel works', () => {
    expect(isHotel(hotel)).toBe(true)
    expect(isHotel(sight)).toBe(false)
  })

  it('isRestaurant works', () => {
    expect(isRestaurant(restaurant)).toBe(true)
    expect(isRestaurant(sight)).toBe(false)
  })
})
