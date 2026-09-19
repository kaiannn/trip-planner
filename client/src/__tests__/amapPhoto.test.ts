import { describe, expect, it } from 'vitest'
import { pickPoiPhoto } from '../api/amap'
import { convertAmapPois } from '../store/utils'
import type { Spot } from '../types'

describe('pickPoiPhoto', () => {
  it('upgrades http AMap photo urls to https (mixed content)', () => {
    expect(
      pickPoiPhoto({
        photos: [{ url: 'http://store.is.autonavi.com/showpic/abc' }],
      }),
    ).toBe('https://store.is.autonavi.com/showpic/abc')
  })

  it('normalizes protocol-relative urls to https', () => {
    expect(pickPoiPhoto({ photos: [{ url: '//wprd01.is.autonavi.com/x.jpg' }] })).toBe(
      'https://wprd01.is.autonavi.com/x.jpg',
    )
  })

  it('trims whitespace around urls', () => {
    expect(pickPoiPhoto({ photos: [{ url: '  https://example.com/p.jpg ' }] })).toBe(
      'https://example.com/p.jpg',
    )
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
    expect(pickPoiPhoto({ photos: [{ title: 'no url' }] })).toBeUndefined()
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
