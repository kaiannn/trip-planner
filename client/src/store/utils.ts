import type { AmapPoi } from '../api/amap'
import { fetchAmapPoiDetail, pickPoiPhoto } from '../api/amap'
import type { DailyPlan, Spot } from '../types'
import { isDuplicateSpot } from '../lib/geo'
import type { GetFn, SetFn } from './types'

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
    const photo = pickPoiPhoto(p)
    spots.push({
      kind: 'sight',
      id: uid(uidPrefix),
      cityId,
      name,
      location: { lat, lng },
      innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
      imageUrl: photo,
      amapId: p.id || undefined,
    })
    added++
  }
  return { spots, added }
}

const PHOTO_ENRICH_CONCURRENCY = 4
const PHOTO_ENRICH_MAX = 12

/** Backfill imageUrl via place/detail for spots that have amapId but no photo. */
export async function enrichSpotPhotos(
  spots: Spot[],
  set: SetFn,
  get: GetFn,
): Promise<number> {
  const pending = spots
    .filter((s) => s.amapId && !s.imageUrl && !s.imageBlobId)
    .slice(0, PHOTO_ENRICH_MAX)
  if (!pending.length) return 0

  let filled = 0
  for (let i = 0; i < pending.length; i += PHOTO_ENRICH_CONCURRENCY) {
    const batch = pending.slice(i, i + PHOTO_ENRICH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (s) => {
        try {
          const detail = await fetchAmapPoiDetail(s.amapId!)
          const photo = detail ? pickPoiPhoto(detail) : undefined
          return photo ? { id: s.id, photo } : null
        } catch {
          return null
        }
      }),
    )
    const updates = results.filter((r): r is { id: string; photo: string } => Boolean(r))
    if (!updates.length) continue
    const byId = new Map(updates.map((u) => [u.id, u.photo]))
    set({
      spots: get().spots.map((s) =>
        byId.has(s.id) && !s.imageUrl && !s.imageBlobId
          ? { ...s, imageUrl: byId.get(s.id) }
          : s,
      ),
    })
    filled += updates.length
  }
  return filled
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
