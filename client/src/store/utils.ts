import type { AmapPoi } from '../api/amap'
import type { DailyPlan, Spot } from '../types'
import { isDuplicateSpot } from '../lib/geo'
import type { GetFn } from './types'

export function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function convertAmapPois(
  pois: AmapPoi[],
  cityId: string,
  existingSpots: Spot[],
  uidPrefix: string,
): { spots: Spot[]; added: number } {
  const spots = [...existingSpots]
  let added = 0
  for (const p of pois) {
    const loc = p.location ? String(p.location).split(',') : []
    const lng = parseFloat(loc[0])
    const lat = parseFloat(loc[1])
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue
    const name = (p.name || '').trim()
    if (!name) continue
    if (isDuplicateSpot(spots, cityId, name, lat, lng)) continue
    const address = (p.address || '').trim()
    const type = (p.type || '').trim()
    const rating = Number(p.biz_ext?.rating || p.rating || 0) || undefined
    const metaParts: string[] = []
    if (type) metaParts.push(type)
    if (address) metaParts.push(address)
    if (rating) metaParts.push(`评分约 ${rating}`)
    spots.push({
      kind: 'sight',
      id: uid(uidPrefix),
      cityId,
      name,
      location: { lat, lng },
      innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
    })
    added++
  }
  return { spots, added }
}

export function collectTripContext(get: GetFn) {
  const s = get()
  return {
    title: s.tripTitle,
    startDate: s.tripStart,
    endDate: s.tripEnd,
    travelExpectation: s.tripExpectation.trim(),
    tripType: s.tripType,
    cities: s.cities,
    spots: s.spots,
    dailyPlans: s.dailyPlans as unknown as DailyPlan[],
  }
}
