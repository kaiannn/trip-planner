import { distanceInMeters } from './geo'
import { effectiveVisitMinutes } from './visitTime'
import type { TaskPace } from './taskBrief'

/** Activity+transit budget (minutes) per day by pace. */
export const DAY_CAPACITY_BY_PACE: Record<TaskPace, number> = {
  relaxed: 300,
  moderate: 420,
  packed: 540,
}

export const DEFAULT_DAY_CAPACITY = DAY_CAPACITY_BY_PACE.moderate

function travelMinutes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  mode: 'walking' | 'driving' | 'transit' = 'transit',
): number {
  const meters = distanceInMeters(a.lat, a.lng, b.lat, b.lng)
  const mps = mode === 'walking' ? 1.3 : mode === 'driving' ? 11 : 7
  const roadFactor = mode === 'walking' ? 1.25 : 1.3
  return Math.max(5, Math.round((meters * roadFactor) / mps / 60))
}

export interface PackableSpot {
  id: string
  cityId: string
  name?: string
  location: { lat: number; lng: number }
  kind: string
  visitMinutes?: number
  visitTimeText?: string
}

export interface PackDayInput {
  dayId: string
  dayIndex: number
  cityId: string
  /** Spots already on this day's default path, in order. */
  existing: PackableSpot[]
}

export interface PackResult {
  /** dayId → final default spotOrder (existing + newly packed). */
  dayOrders: Record<string, string[]>
  /** Unassigned packable ids that did not fit. */
  leftoverIds: string[]
  /** dayId → estimated minutes used (visit + inter-stop travel). */
  dayLoadMinutes: Record<string, number>
}

export interface PackOptions {
  pace?: TaskPace | ''
  /** Override total day budget in minutes. */
  dayCapacityMinutes?: number
  /** Kinds eligible for packing. Default: sight + restaurant (not hotel). */
  packKinds?: string[]
  transportMode?: 'walking' | 'driving' | 'transit'
}

/**
 * Greedy nearest-neighbor pack of unassigned spots into day slots.
 * - A spot only joins days with matching (or empty) cityId.
 * - Existing spotOrder is preserved; new ids are appended.
 * - Pure: no store, no network.
 */
export function packSpotsIntoDays(
  days: PackDayInput[],
  unassigned: PackableSpot[],
  opts: PackOptions = {},
): PackResult {
  const packKinds = opts.packKinds ?? ['sight', 'restaurant']
  const capacity = Math.max(
    60,
    opts.dayCapacityMinutes ??
      (opts.pace ? DAY_CAPACITY_BY_PACE[opts.pace] : DEFAULT_DAY_CAPACITY),
  )
  const mode = opts.transportMode ?? 'transit'

  const dayOrders: Record<string, string[]> = {}
  const dayLoad = new Map<string, number>()
  const remainingCap = new Map<string, number>()
  const dayLastLoc = new Map<string, { lat: number; lng: number } | null>()
  const dayHasRoom = new Map<string, boolean>()

  for (const d of days) {
    const order = d.existing.map((s) => s.id)
    dayOrders[d.dayId] = order

    let used = 0
    let lastLoc: { lat: number; lng: number } | null = null
    for (let i = 0; i < d.existing.length; i++) {
      const sp = d.existing[i]
      used += effectiveVisitMinutes(sp)
      if (lastLoc) used += travelMinutes(lastLoc, sp.location, mode)
      lastLoc = sp.location
    }

    const left = Math.max(0, capacity - used)
    remainingCap.set(d.dayId, left)
    dayLoad.set(d.dayId, used)
    dayLastLoc.set(d.dayId, lastLoc)
    dayHasRoom.set(d.dayId, left > 30)
  }

  const pool = unassigned
    .filter((s) => packKinds.includes(s.kind))
    .slice()
    .sort((a, b) => effectiveVisitMinutes(b) - effectiveVisitMinutes(a))

  for (const spot of pool) {
    const visit = effectiveVisitMinutes(spot)
    let bestDayId: string | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const d of days) {
      if (!dayHasRoom.get(d.dayId)) continue
      if (d.cityId && d.cityId !== spot.cityId) continue
      const last = dayLastLoc.get(d.dayId)
      const travel = last ? travelMinutes(last, spot.location, mode) : 0
      const need = visit + travel
      const cap = remainingCap.get(d.dayId) ?? 0
      if (need > cap) continue
      // Prefer shorter detour; mild preference for earlier days on ties.
      const score = travel * 1000 + d.dayIndex
      if (score < bestScore) {
        bestScore = score
        bestDayId = d.dayId
      }
    }

    if (!bestDayId) continue

    const last = dayLastLoc.get(bestDayId)
    const travel = last ? travelMinutes(last, spot.location, mode) : 0
    dayOrders[bestDayId] = [...dayOrders[bestDayId], spot.id]
    remainingCap.set(bestDayId, (remainingCap.get(bestDayId) ?? 0) - visit - travel)
    dayLoad.set(bestDayId, (dayLoad.get(bestDayId) ?? 0) + visit + travel)
    dayLastLoc.set(bestDayId, spot.location)
    if ((remainingCap.get(bestDayId) ?? 0) <= 30) dayHasRoom.set(bestDayId, false)
  }

  const placed = new Set(Object.values(dayOrders).flat())
  const leftoverIds = pool
    .filter((s) => !placed.has(s.id))
    .map((s) => s.id)

  const dayLoadMinutes: Record<string, number> = {}
  for (const [k, v] of dayLoad) dayLoadMinutes[k] = v

  return { dayOrders, leftoverIds, dayLoadMinutes }
}
