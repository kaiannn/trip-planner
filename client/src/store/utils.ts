import type { AmapPoi } from '../api/amap'
import { fetchAmapPoiDetail, fetchAmapPoiList, pickPoiPhoto } from '../api/amap'
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
const PHOTO_BACKFILL_MAX = 8

function hasPhoto(s: Spot): boolean {
  return Boolean(s.imageUrl || s.imageBlobId)
}

function applySpotPatch(
  spots: Spot[],
  patches: Map<string, Partial<Spot>>,
): Spot[] {
  if (!patches.size) return spots
  return spots.map((s) => {
    const p = patches.get(s.id)
    return p ? { ...s, ...p } : s
  })
}

/** Backfill imageUrl via place/detail for spots that have amapId but no photo. */
export async function enrichSpotPhotos(
  spots: Spot[],
  set: SetFn,
  get: GetFn,
): Promise<number> {
  const pending = spots
    .filter((s) => s.amapId && !hasPhoto(s))
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
    const byId = new Map(updates.map((u) => [u.id, { imageUrl: u.photo }]))
    set({ spots: applySpotPatch(get().spots, byId) })
    filled += updates.length
  }
  return filled
}

/**
 * For legacy pool spots (no amapId / no photo): search by name+city,
 * attach amapId + first photo when names match closely enough.
 */
export async function backfillSpotPhotosByName(
  set: SetFn,
  get: GetFn,
  limit = PHOTO_BACKFILL_MAX,
): Promise<number> {
  const s = get()
  const cityById = new Map(s.cities.map((c) => [c.id, c] as const))
  const pending = s.spots
    .filter((sp) => !hasPhoto(sp) && sp.name.trim())
    .slice(0, limit)
  if (!pending.length) return 0

  let filled = 0
  for (const spot of pending) {
    const city = cityById.get(spot.cityId)
    if (!city?.name) continue
    try {
      const pois = await fetchAmapPoiList({
        city: city.name,
        keywords: spot.name.trim(),
        quality: 'normal',
      })
      if (!pois.length) continue
      const name = spot.name.trim()
      const exact = pois.find((p) => (p.name || '').trim() === name)
      const candidate = exact ?? pois.find((p) => pickPoiPhoto(p)) ?? pois[0]
      const photo = pickPoiPhoto(candidate)
      const amapId = candidate.id || undefined
      if (!photo && !amapId) continue
      // Prefer detail when list has id but no photo
      let finalPhoto = photo
      if (!finalPhoto && amapId) {
        try {
          const detail = await fetchAmapPoiDetail(amapId)
          finalPhoto = detail ? pickPoiPhoto(detail) : undefined
        } catch {
          /* ignore */
        }
      }
      if (!finalPhoto && !amapId) continue
      const latest = get().spots.find((x) => x.id === spot.id)
      if (!latest || hasPhoto(latest)) continue
      set({
        spots: applySpotPatch(
          get().spots,
          new Map([[spot.id, { imageUrl: finalPhoto, amapId }]]),
        ),
      })
      filled += 1
    } catch {
      /* skip one spot */
    }
  }
  return filled
}

/** Boot / manual: amapId detail first, then name search for leftovers. */
export async function backfillMissingSpotPhotos(
  set: SetFn,
  get: GetFn,
): Promise<number> {
  const n1 = await enrichSpotPhotos(get().spots, set, get)
  const n2 = await backfillSpotPhotosByName(set, get)
  return n1 + n2
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
