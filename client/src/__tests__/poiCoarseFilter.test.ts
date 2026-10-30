import { describe, it, expect } from 'vitest'
import {
  amapTypesForInterests,
  buildCoarseFilterUserPrompt,
  parseKeepIds,
} from '../lib/poiCoarseFilter'
import { parseAmapLocation } from '../api/amap'

const pois = [
  { id: 'B1', name: '西湖', type: '风景名胜;5A', rating: 4.8 },
  { id: 'B2', name: '某商场', type: '购物', rating: 3.1 },
  { id: 'B3', name: '川菜馆', type: '餐饮', cost: '¥50' },
]

describe('amapTypesForInterests', () => {
  it('falls back to sight types when empty', () => {
    expect(amapTypesForInterests([])).toBe('110000')
  })

  it('maps interest tags and dedupes codes', () => {
    const types = amapTypesForInterests(['美食', '美食', '人文'])
    expect(types).toContain('050000')
    expect(types).toContain('110200')
    expect(new Set(types.split('|')).size).toBe(types.split('|').length)
  })
})

describe('buildCoarseFilterUserPrompt', () => {
  it('lists only provided ids and asks for keepIds JSON', () => {
    const prompt = buildCoarseFilterUserPrompt(
      pois,
      { description: '安静的地方', interests: ['人文'], pace: '松弛', budgetPerDay: 400 },
      8,
    )
    expect(prompt).toContain('id=B1')
    expect(prompt).toContain('id=B2')
    expect(prompt).toContain('禁止编造')
    expect(prompt).toContain('最多 8 个')
    expect(prompt).toContain('{"keepIds":')
  })
})

describe('parseKeepIds', () => {
  it('filters to allowed set, dedupes, preserves order', () => {
    const allowed = ['B1', 'B2', 'B3']
    const keep = parseKeepIds(
      { keepIds: ['B3', 'B1', 'B3', 'evil', 42, 'B1'] },
      allowed,
    )
    expect(keep).toEqual(['B3', 'B1'])
  })

  it('returns [] on invalid shapes', () => {
    expect(parseKeepIds(null, ['B1'])).toEqual([])
    expect(parseKeepIds({}, ['B1'])).toEqual([])
    expect(parseKeepIds({ keepIds: 'B1' }, ['B1'])).toEqual([])
    expect(parseKeepIds({ keepIds: [] }, ['B1'])).toEqual([])
  })
})

describe('parseAmapLocation', () => {
  it('parses lng,lat', () => {
    expect(parseAmapLocation('120.1,30.2')).toEqual({ lat: 30.2, lng: 120.1 })
  })

  it('rejects bad input', () => {
    expect(parseAmapLocation(undefined)).toBeNull()
    expect(parseAmapLocation('')).toBeNull()
    expect(parseAmapLocation('a,b')).toBeNull()
  })
})
