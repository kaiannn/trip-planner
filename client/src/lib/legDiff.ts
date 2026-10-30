/** Consecutive stop pairs for a day path: [A,B], [B,C], … */
export type Leg = [fromId: string, toId: string]

export function legsFromOrder(order: string[]): Leg[] {
  const legs: Leg[] = []
  for (let i = 0; i < order.length - 1; i++) {
    legs.push([order[i], order[i + 1]])
  }
  return legs
}

function legKey(leg: Leg): string {
  return `${leg[0]}|${leg[1]}`
}

export interface LegDiff {
  /** Legs present after the edit (new pairs to route). */
  added: Leg[]
  /** Legs that disappeared (no longer drawn). */
  removed: Leg[]
  /** Unchanged pairs — safe to reuse cached road geometry. */
  kept: Leg[]
}

/**
 * Diff consecutive legs when a day's spotOrder changes (drag-in, reorder, move).
 * Kept legs map 1:1 onto segmentCache keys in amapRouting, so a full redraw
 * only misses network for `added`.
 */
export function diffLegs(prevOrder: string[], nextOrder: string[]): LegDiff {
  const prev = legsFromOrder(prevOrder)
  const next = legsFromOrder(nextOrder)
  const prevSet = new Set(prev.map(legKey))
  const nextSet = new Set(next.map(legKey))

  const kept = next.filter((l) => prevSet.has(legKey(l)))
  const added = next.filter((l) => !prevSet.has(legKey(l)))
  const removed = prev.filter((l) => !nextSet.has(legKey(l)))
  return { added, removed, kept }
}

/**
 * Spot ids whose incident legs changed (moved / inserted / removed).
 * Useful for "only these pins need attention" UI hints.
 */
export function spotsWithChangedLegs(diff: LegDiff): string[] {
  const set = new Set<string>()
  for (const [a, b] of diff.added) {
    set.add(a)
    set.add(b)
  }
  for (const [a, b] of diff.removed) {
    set.add(a)
    set.add(b)
  }
  return [...set]
}
