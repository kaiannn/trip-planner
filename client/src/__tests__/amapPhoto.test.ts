import { describe, expect, it } from 'vitest'
import { pickPoiPhoto, type AmapPoi } from '../api/amap'
import { convertAmapPois } from '../store/utils'
import type { Spot } from '../types'

describe('pickPoiPhoto', () => {
  it('returns first https photo url', () => {
    const poi: AmapPoi = {
      photos: [
        { title: 'a', url: 'http://insecure.example/a.jpg' },
        { title: 'b', url: 'https://example.com/b.jpg' },
      ],
    }
    expect(pickPoiPhoto(poi)).toBe('https://example.com/b.jpg')
  })

  it('handles single photo object and string urls', () => {
    expect(pickPoiPhoto({ photos: { url: 'https://example.com/x.jpg' } })).toBe(
      'https://example.com/x.jpg',
    )
    expect(pickPoiPhoto({ photos: 'https://example.com/s.jpg' as never })).toBe(
      'https://example.com/s.jpg',
    )
  })

  it('returns undefined when no usable photo', () => {
    expect(pickPoiPhoto({})).toBeUndefined()
    expect(pickPoiPhoto({ photos: [{ url: 'ftp://x' }] })).toBeUndefined()
  })
})

describe('convertAmapPois amapId + photo', () => {
  it('writes amapId and imageUrl when present', () => {
    const { spots, added } = convertAmapPois(
      [
        {
          id: 'B0FFFAB6J2',
          name: '雷峰塔',
          location: '120.148,30.231',
          photos: [{ url: 'https://example.com/leifeng.jpg' }],
        },
      ],
      'city1',
      [] as Spot[],
      'spot_test',
    )
    expect(added).toBe(1)
    expect(spots[0].amapId).toBe('B0FFFAB6J2')
    expect(spots[0].imageUrl).toBe('https://example.com/leifeng.jpg')
  })

  it('still adds spot without photo so enrich can backfill', () => {
    const { spots, added } = convertAmapPois(
      [{ id: 'B0NOIMG', name: '无图点', location: '120,30' }],
      'city1',
      [] as Spot[],
      'spot_test',
    )
    expect(added).toBe(1)
    expect(spots[0].amapId).toBe('B0NOIMG')
    expect(spots[0].imageUrl).toBeUndefined()
  })
})
