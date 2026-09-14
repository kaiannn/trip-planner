import type { CyclingSegment, CyclingStop, CyclingStopKind } from './types'
import { CYCLING_STOP_KIND_ICON, CYCLING_STOP_KIND_LABEL } from './types'

export function formatKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—'
  const km = meters / 1000
  if (km < 10) return `${km.toFixed(2)} km`
  return `${km.toFixed(1)} km`
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const totalMin = Math.round(sec / 60)
  if (totalMin < 60) return `${totalMin} 分钟`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`
}

/** 按均速估算时长（秒），与高德预估并列展示 */
export function estimateDurationSec(distanceM: number, avgSpeedKmh: number): number {
  const speed = avgSpeedKmh > 0 ? avgSpeedKmh : 20
  return (distanceM / 1000 / speed) * 3600
}

export function parseDepartTime(hhmm: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return { h, m: min }
}

/** 在出发时刻上叠加骑行分钟数，返回 HH:mm（可跨天取模 24h） */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const t = parseDepartTime(hhmm) ?? { h: 8, m: 0 }
  const total = t.h * 60 + t.m + Math.max(0, Math.round(minutes))
  const mod = ((total % 1440) + 1440) % 1440
  const h = Math.floor(mod / 60)
  const m = mod % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function hasLocatedEndpoints(stops: CyclingStop[]): boolean {
  const located = stops.filter((s) => s.location)
  return located.length >= 2
}

/** 取有坐标的有序节点，用于分段规划 */
export function locatedStops(stops: CyclingStop[]): CyclingStop[] {
  return stops.filter((s) => s.location)
}

export function sumSegmentDistance(segments: CyclingSegment[]): number {
  return segments.reduce((acc, s) => acc + (s.distance || 0), 0)
}

export function sumSegmentDuration(segments: CyclingSegment[]): number {
  return segments.reduce((acc, s) => acc + (s.duration || 0), 0)
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|')
}

export function buildCyclingMarkdown(input: {
  title: string
  stops: CyclingStop[]
  segments: CyclingSegment[]
  totalDistance: number
  avgSpeedKmh: number
  departTime: string
  notes?: string
}): string {
  const { title, stops, segments, totalDistance, avgSpeedKmh, departTime, notes } = input
  const est = estimateDurationSec(totalDistance, avgSpeedKmh)
  const lines: string[] = []
  lines.push(`# ${title || '骑行路书'}`)
  lines.push('')
  lines.push(`- 总里程：${formatKm(totalDistance)}`)
  lines.push(`- 预估骑行（均速 ${avgSpeedKmh} km/h）：${formatDuration(est)}`)
  lines.push(`- 建议出发：${departTime}`)
  if (notes?.trim()) {
    lines.push('')
    lines.push(notes.trim())
  }
  lines.push('')
  lines.push('## 节点')
  lines.push('')
  lines.push('| # | 类型 | 名称 | 累计里程 | 备注 |')
  lines.push('| --- | --- | --- | --- | --- |')

  let cum = 0
  let segIdx = 0
  stops.forEach((stop, i) => {
    if (i > 0) {
      const seg = segments[segIdx]
      if (seg) cum += seg.distance
      segIdx += 1
    }
    const icon = CYCLING_STOP_KIND_ICON[stop.kind]
    const kindLabel = CYCLING_STOP_KIND_LABEL[stop.kind]
    const name = escapeMd(stop.name || '未命名')
    const note = escapeMd(stop.note || stop.address || '')
    const cumText = i === 0 ? '0' : formatKm(cum)
    lines.push(`| ${i + 1} | ${icon} ${kindLabel} | ${name} | ${cumText} | ${note} |`)
  })

  lines.push('')
  lines.push('## 分段')
  lines.push('')
  if (!segments.length) {
    lines.push('_尚未规划分段_')
  } else {
    lines.push('| 从 | 到 | 距离 | 高德预估 |')
    lines.push('| --- | --- | --- | --- |')
    segments.forEach((seg) => {
      const from = stops.find((s) => s.id === seg.fromId)?.name ?? '?'
      const to = stops.find((s) => s.id === seg.toId)?.name ?? '?'
      lines.push(
        `| ${escapeMd(from)} | ${escapeMd(to)} | ${formatKm(seg.distance)} | ${formatDuration(seg.duration)} |`,
      )
    })
  }

  lines.push('')
  lines.push(`> 由 Trip Planner 骑行路书生成 · 分段数据来自高德骑行路径规划`)
  lines.push('')
  return lines.join('\n')
}

export function createStopId(): string {
  return `cstop_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

export function defaultStopKindAfter(kind: CyclingStopKind): CyclingStopKind {
  if (kind === 'start') return 'checkpoint'
  return 'checkpoint'
}

export function clampAvgSpeed(v: number): number {
  if (!Number.isFinite(v)) return 20
  return Math.min(40, Math.max(5, Math.round(v * 10) / 10))
}
