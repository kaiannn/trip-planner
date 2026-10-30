/**
 * Structured task brief distilled from trip state + explicit brief fields.
 * Used to drive missing-slot UI (no LLM) and a compact prompt section.
 */

export type TaskPace = 'relaxed' | 'moderate' | 'packed'

export const PACE_OPTIONS: { value: TaskPace; label: string }[] = [
  { value: 'relaxed', label: '松弛' },
  { value: 'moderate', label: '适中' },
  { value: 'packed', label: '紧凑' },
]

export const PACE_LABELS: Record<TaskPace, string> = {
  relaxed: '松弛',
  moderate: '适中',
  packed: '紧凑',
}

export const INTEREST_OPTIONS = [
  '美食',
  '自然',
  '人文',
  '亲子',
  '购物',
  '夜生活',
  '小众',
] as const

export type MissingSlot =
  | 'destination'
  | 'days'
  | 'budget'
  | 'pace'
  | 'interest_focus'

export const MISSING_SLOT_LABELS: Record<MissingSlot, string> = {
  destination: '目的地',
  days: '天数',
  budget: '预算',
  pace: '节奏',
  interest_focus: '兴趣',
}

export interface TaskBriefSource {
  cityNames: string[]
  tripStart: string
  tripEnd: string
  dailyPlanCount: number
  /** Raw aiBudget string; empty / NaN → missing. */
  aiBudget: string
  /** Explicit override, empty string = unset. */
  taskPace: string
  taskInterests: string[]
  /** Explicit day count override when dates/plans are absent. */
  taskDays: number | null
}

export interface TaskBrief {
  destination: string | null
  days: number | null
  budgetPerDay: number | null
  pace: TaskPace | null
  interestFocus: string[]
}

function isPace(v: string): v is TaskPace {
  return v === 'relaxed' || v === 'moderate' || v === 'packed'
}

function daysBetween(start: string, end: string): number | null {
  if (!start || !end) return null
  const a = new Date(start)
  const b = new Date(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const ms = b.getTime() - a.getTime()
  if (ms < 0) return null
  return Math.round(ms / 86_400_000) + 1
}

/** Priority for days: daily plans → date range → explicit taskDays. */
export function resolveDays(src: TaskBriefSource): number | null {
  if (src.dailyPlanCount > 0) return src.dailyPlanCount
  const byDates = daysBetween(src.tripStart, src.tripEnd)
  if (byDates !== null) return byDates
  if (src.taskDays !== null && Number.isFinite(src.taskDays) && src.taskDays > 0) {
    return src.taskDays
  }
  return null
}

export function buildTaskBrief(src: TaskBriefSource): TaskBrief {
  const destination = src.cityNames.length ? src.cityNames.join(' → ') : null
  const budgetRaw = src.aiBudget.trim()
  const budgetNum = budgetRaw ? Number.parseFloat(budgetRaw) : Number.NaN
  const budgetPerDay =
    Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : null
  const pace = isPace(src.taskPace) ? src.taskPace : null
  const interestFocus = src.taskInterests.filter((x) => x.trim())

  return {
    destination,
    days: resolveDays(src),
    budgetPerDay,
    pace,
    interestFocus,
  }
}

export function missingSlots(brief: TaskBrief): MissingSlot[] {
  const missing: MissingSlot[] = []
  if (!brief.destination) missing.push('destination')
  if (brief.days === null) missing.push('days')
  if (brief.budgetPerDay === null) missing.push('budget')
  if (brief.pace === null) missing.push('pace')
  if (!brief.interestFocus.length) missing.push('interest_focus')
  return missing
}

/** Compact one-line summary for UI chips. */
export function formatBriefLine(brief: TaskBrief): string {
  const parts: string[] = []
  if (brief.destination) parts.push(brief.destination)
  if (brief.days !== null) parts.push(`${brief.days} 天`)
  if (brief.budgetPerDay !== null) parts.push(`预算 ¥${brief.budgetPerDay}/天`)
  if (brief.pace) parts.push(PACE_LABELS[brief.pace])
  if (brief.interestFocus.length) parts.push(brief.interestFocus.join('·'))
  return parts.length ? parts.join(' · ') : ''
}

/** Prompt block injected by buildAiPrompt when a brief is available. */
export function formatBriefForPrompt(brief: TaskBrief): string {
  const lines: string[] = ['【任务简报（结构化约束，优先于散文期望）】']
  lines.push(`- 目的地：${brief.destination ?? '未确定'}`)
  lines.push(`- 天数：${brief.days !== null ? `${brief.days} 天` : '未确定'}`)
  lines.push(
    `- 每日预算：${brief.budgetPerDay !== null ? `${brief.budgetPerDay} 元` : '未确定'}`,
  )
  lines.push(`- 节奏：${brief.pace ? PACE_LABELS[brief.pace] : '未确定'}`)
  lines.push(
    `- 兴趣重点：${brief.interestFocus.length ? brief.interestFocus.join('、') : '未确定'}`,
  )
  return lines.join('\n')
}
