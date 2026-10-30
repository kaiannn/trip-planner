/** Parse free-form visit duration text → minutes, or null if unparseable. */

const HOUR_MS = 60
const DAY_MIN = 8 * HOUR_MS // treat "一整天" / "一天" as 8h sightseeing

/**
 * Accepts patterns like:
 * - "2小时" "2 小时" "90分钟" "1.5h" "2-3小时" (→ midpoint)
 * - "半天" / "半天 + 演出" → 240
 * - "一整天" / "一天" / "全天" → 480
 * - "1.5 小时" "30 min" "45min"
 */
export function parseVisitMinutes(text: string | undefined | null): number | null {
  if (!text) return null
  const raw = text.trim()
  if (!raw) return null

  if (/一整天|全天|一整天|整天|一天(?!半)/.test(raw) && !/\d/.test(raw)) {
    return DAY_MIN
  }
  if (/半天/.test(raw) && !/\d/.test(raw)) {
    return 240
  }

  // Range "2-3小时" / "2~3 小时" / "1-1.5h"
  const range = raw.match(
    /(\d+(?:\.\d+)?)\s*[-~—–至到]\s*(\d+(?:\.\d+)?)\s*(小时|h|H|小时制|hrs?|hours?)?/,
  )
  if (range) {
    const a = Number.parseFloat(range[1])
    const b = Number.parseFloat(range[2])
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      const mid = (a + b) / 2
      const isHourUnit = Boolean(range[3])
      // bare numbers after 小时-like unit, or unit present
      return Math.round(isHourUnit || /小时|h|H/.test(range[3] || '') ? mid * HOUR_MS : mid)
    }
  }

  // Hours: "2小时" "1.5h" "2 hrs"
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*(小时|hrs?|hours?|h(?![a-z]))/i)
  if (hours) {
    const h = Number.parseFloat(hours[1])
    if (Number.isFinite(h) && h > 0) return Math.max(15, Math.round(h * HOUR_MS))
  }

  // Minutes: "90分钟" "45min" "30 minutes"
  const mins = raw.match(/(\d+(?:\.\d+)?)\s*(分钟|min|minutes?|m(?!inute))/i)
  if (mins) {
    const m = Number.parseFloat(mins[1])
    if (Number.isFinite(m) && m > 0) return Math.max(10, Math.round(m))
  }

  // Bare number: treat ≤ 12 as hours, larger as minutes (common shorthand)
  const bare = raw.match(/^(\d+(?:\.\d+)?)$/)
  if (bare) {
    const n = Number.parseFloat(bare[1])
    if (!Number.isFinite(n) || n <= 0) return null
    return n <= 12 ? Math.round(n * HOUR_MS) : Math.round(n)
  }

  return null
}

export const DEFAULT_VISIT_MINUTES: Record<string, number> = {
  sight: 90,
  restaurant: 60,
  hotel: 0,
}

export function effectiveVisitMinutes(spot: {
  visitMinutes?: number
  visitTimeText?: string
  kind?: string
}): number {
  if (typeof spot.visitMinutes === 'number' && spot.visitMinutes > 0) {
    return spot.visitMinutes
  }
  const parsed = parseVisitMinutes(spot.visitTimeText)
  if (parsed !== null) return parsed
  return DEFAULT_VISIT_MINUTES[spot.kind || 'sight'] ?? 90
}
