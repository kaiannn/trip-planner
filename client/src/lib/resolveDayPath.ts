import type { DayBranch, DailyPlan } from '../types'

type DayLike = Pick<DailyPlan, 'spotOrder' | 'dayBranches' | 'activeBranchId'>

export const BRANCH_PRESETS: { when: string; label: string }[] = [
  { when: 'rain', label: '下雨' },
  { when: 'clear', label: '放晴' },
  { when: 'tired', label: '累了' },
  { when: 'time', label: '时间紧' },
]

/** Spot order under the active branch (or default when none). */
export function resolveDaySpotOrder(day: DayLike): string[] {
  const id = day.activeBranchId
  if (!id) return [...day.spotOrder]
  const branch = day.dayBranches?.find((b) => b.id === id)
  return branch ? [...branch.spotOrder] : [...day.spotOrder]
}

/** Every spot id referenced by any branch or the default path. */
export function allPlannedSpotIds(day: DayLike): Set<string> {
  const set = new Set(day.spotOrder)
  day.dayBranches?.forEach((b) => b.spotOrder.forEach((id) => set.add(id)))
  return set
}

/** Spots only on non-active branches (for ghost markers / pool exclusion). */
export function inactiveBranchSpotIds(day: DayLike): Set<string> {
  const active = new Set(resolveDaySpotOrder(day))
  const all = allPlannedSpotIds(day)
  const out = new Set<string>()
  all.forEach((id) => {
    if (!active.has(id)) out.add(id)
  })
  return out
}

export function hasBranches(day: Pick<DailyPlan, 'dayBranches'>): boolean {
  return (day.dayBranches?.length ?? 0) > 0
}

/** Concise path preview: names joined with arrows, capped. */
export function formatPathPreview(
  spotOrder: string[],
  nameOf: (id: string) => string,
  max = 4,
): string {
  if (!spotOrder.length) return '（空）'
  const names = spotOrder.map(nameOf)
  if (names.length <= max) return names.join(' → ')
  return `${names.slice(0, max).join(' → ')} → +${names.length - max}`
}

/** Straight-line legs for non-active branches (map ghost lines). */
export function branchGhostLegs(
  day: DayLike,
  locations: Map<string, { lat: number; lng: number }>,
): { from: { lat: number; lng: number }; to: { lat: number; lng: number } }[] {
  const legs: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }[] = []
  const branches = day.dayBranches ?? []
  const activeId = day.activeBranchId ?? null
  for (const b of branches) {
    if (b.id === activeId) continue
    for (let i = 0; i < b.spotOrder.length - 1; i++) {
      const a = locations.get(b.spotOrder[i])
      const c = locations.get(b.spotOrder[i + 1])
      if (a && c) legs.push({ from: a, to: c })
    }
  }
  return legs
}

export function findBranch(day: DayLike, branchId: string): DayBranch | null {
  return day.dayBranches?.find((b) => b.id === branchId) ?? null
}
