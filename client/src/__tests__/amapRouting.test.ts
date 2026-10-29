import { describe, it, expect } from 'vitest'
import { TRANSPORT_LABEL, TRANSPORT_ICON, TRANSPORT_DASH, estimateSegment } from '../lib/amapRouting'

describe('TRANSPORT_LABEL', () => {
  it('has labels for the three offered modes', () => {
    expect(TRANSPORT_LABEL.driving).toBeTruthy()
    expect(TRANSPORT_LABEL.walking).toBeTruthy()
    expect(TRANSPORT_LABEL.transit).toBe('公共交通')
    expect(Object.keys(TRANSPORT_LABEL)).not.toContain('riding')
  })
})

describe('TRANSPORT_ICON', () => {
  it('has icons for the three offered modes', () => {
    expect(TRANSPORT_ICON.driving).toBeTruthy()
    expect(TRANSPORT_ICON.walking).toBeTruthy()
    expect(TRANSPORT_ICON.transit).toBeTruthy()
  })
})

describe('TRANSPORT_DASH', () => {
  it('driving is solid', () => {
    expect(TRANSPORT_DASH.driving).toBe('solid')
  })

  it('non-driving modes are dashed', () => {
    expect(TRANSPORT_DASH.walking).toBe('dashed')
    expect(TRANSPORT_DASH.transit).toBe('dashed')
  })
})

describe('estimateSegment', () => {
  // ~1.1 km apart near Hangzhou
  const a = { lat: 30.25, lng: 120.15 }
  const b = { lat: 30.26, lng: 120.16 }

  it('returns an estimated walking segment for short hops', () => {
    const est = estimateSegment('walking', a, b)
    expect(est).not.toBeNull()
    expect(est!.estimated).toBe(true)
    expect(est!.distance).toBeGreaterThan(0)
    expect(est!.duration).toBeGreaterThan(0)
    expect(est!.path.length).toBe(2)
  })

  it('still estimates transit for moderate distances', () => {
    const est = estimateSegment('transit', a, b)
    expect(est?.estimated).toBe(true)
  })

  it('returns null when walking distance is implausibly long', () => {
    // Beijing → Shanghai-ish
    const far = estimateSegment('walking', { lat: 39.9, lng: 116.4 }, { lat: 31.2, lng: 121.5 })
    expect(far).toBeNull()
  })

  it('returns null for identical points', () => {
    expect(estimateSegment('driving', a, a)).toBeNull()
  })
})
