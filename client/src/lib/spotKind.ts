import type { Spot, SpotKind } from '../types'

export const SPOT_KIND_LABEL: Record<SpotKind, string> = {
  sight: '景点',
  hotel: '酒店',
  restaurant: '餐厅',
}

export const SPOT_KIND_ICON: Record<SpotKind, string> = {
  sight: '🏛',
  hotel: '🏨',
  restaurant: '🍽',
}

/** Fixed colors for non-sight pins. Sights use their day color or grey. */
export const SPOT_KIND_COLOR: Record<SpotKind, string> = {
  sight: '#94a3b8',
  hotel: '#b91c1c',
  restaurant: '#ea580c',
}

export const DAY_COLORS = [
  '#059669', '#2563eb', '#7c3aed', '#c026d3',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
]

/**
 * Defensive: existing persisted data may lack a kind (pre-migration).
 * Any unknown/missing value is treated as 'sight'.
 */
export function spotKind(s: Spot | { kind?: SpotKind } | undefined): SpotKind {
  const k = (s as { kind?: SpotKind } | undefined)?.kind
  return k === 'hotel' || k === 'restaurant' ? k : 'sight'
}

/** Narrow helpers so components don't have to sprinkle kind guards. */
export function isSight(s: Spot): s is Extract<Spot, { kind: 'sight' }> {
  return spotKind(s) === 'sight'
}
export function isHotel(s: Spot): s is Extract<Spot, { kind: 'hotel' }> {
  return spotKind(s) === 'hotel'
}
export function isRestaurant(
  s: Spot,
): s is Extract<Spot, { kind: 'restaurant' }> {
  return spotKind(s) === 'restaurant'
}
