import type { AmapPoi } from '../api/amap'
import type { Spot } from '../types'

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/**
 * Convert an array of AMap POI results into Spot objects.
 * Deduplicates against existing spots and skips entries with invalid coords.
 */
export function convertAmapPoisToSpots(
  pois: AmapPoi[],
  cityId: string,
  existingSpots: Spot[],
  uidPrefix: string,
  isDuplicate: (spots: Spot[], cityId: string, name: string, lat: number, lng: number) => boolean,
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
    if (isDuplicate(spots, cityId, name, lat, lng)) continue
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

/**
 * Helper type for the get() function from Zustand.
 * We use a minimal type to avoid circular imports.
 */
export type StoreGet = () => { mapRedrawNonce: number; [key: string]: unknown }

/**
 * Bump map redraw nonce and schedule AI refresh.
 * Call this after any data mutation that affects the map or trip plan.
 */
export function invalidateTrip(
  set: (partial: unknown) => void,
  get: StoreGet,
  scheduleAiRefresh: () => void,
) {
  set({ mapRedrawNonce: (get() as { mapRedrawNonce: number }).mapRedrawNonce + 1 })
  scheduleAiRefresh()
}
