/**
 * LLM coarse filter over real AMap POIs: the model only keeps/drops ids
 * from a closed set — it never invents names or coordinates.
 */

export interface CoarseFilterPoi {
  id: string
  name: string
  type?: string
  rating?: number
  cost?: string
}

export interface CoarseFilterBriefLine {
  description?: string
  interests?: string[]
  pace?: string
  budgetPerDay?: number | null
}

/** Map interest tags → AMap place types (best-effort; multi types joined by |). */
export const INTEREST_AMAP_TYPES: Record<string, string> = {
  美食: '050000',
  自然: '110300',
  人文: '110200',
  亲子: '060100|050000|110000',
  购物: '060000',
  夜生活: '080000|050000',
  小众: '110000|090000',
}

export const DEFAULT_AMAP_SIGHT_TYPES = '110000'

export function amapTypesForInterests(interests: string[], fallback = DEFAULT_AMAP_SIGHT_TYPES): string {
  const codes = interests
    .map((tag) => INTEREST_AMAP_TYPES[tag])
    .filter((v): v is string => Boolean(v))
  if (!codes.length) return fallback
  const all = codes.join('|').split('|').filter(Boolean)
  return [...new Set(all)].join('|')
}

export function buildCoarseFilterUserPrompt(
  pois: CoarseFilterPoi[],
  brief: CoarseFilterBriefLine,
  maxKeep: number,
): string {
  const lines: string[] = []
  lines.push('候选 POI（仅可从这些 id 中选择，禁止编造新 id）：')
  for (const p of pois) {
    const bits = [`id=${p.id}`, `名称=${p.name}`]
    if (p.type) bits.push(`类型=${p.type}`)
    if (p.rating !== undefined && p.rating !== null) bits.push(`评分=${p.rating}`)
    if (p.cost) bits.push(`价位=${p.cost}`)
    lines.push(`- ${bits.join(', ')}`)
  }
  lines.push('')
  lines.push('用户约束：')
  lines.push(`- 描述：${brief.description?.trim() || '（无）'}`)
  lines.push(`- 兴趣：${brief.interests?.length ? brief.interests.join('、') : '（无）'}`)
  lines.push(`- 节奏：${brief.pace || '（无）'}`)
  lines.push(
    `- 每日预算：${brief.budgetPerDay ? `${brief.budgetPerDay} 元` : '（无）'}`,
  )
  lines.push('')
  lines.push(
    `请从中选出最多 ${maxKeep} 个最合适的 id，按推荐优先级从高到低排列。` +
      '淘汰与明显冲突或明显冗余的（例如类型完全不符、评分过低且无特色）。' +
      '只输出 JSON：{"keepIds":["id1","id2"]}。',
  )
  return lines.join('\n')
}

export const COARSE_FILTER_SYSTEM_PROMPT =
  '你是旅游行程的候选 POI 粗筛器。你只做取舍，不生成行程、不编造地点。' +
  '只输出 JSON，不要解释文字。'

/**
 * Parse keepIds from model JSON; keep only ids present in the candidate set,
 * preserve model order, drop duplicates. Invalid / empty → [].
 */
export function parseKeepIds(data: unknown, allowedIds: string[]): string[] {
  const allowed = new Set(allowedIds)
  const obj = data as Record<string, unknown> | null
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.keepIds)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of obj.keepIds) {
    if (typeof raw !== 'string') continue
    const id = raw.trim()
    if (!id || !allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
