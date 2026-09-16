import { requireAmapWebServiceKey } from '../lib/amapKey'
import type { CyclingLatLng, CyclingNearbyPoi, CyclingSegment } from './types'

function requireKey(): string {
  return requireAmapWebServiceKey()
}

function fmtCoord(p: CyclingLatLng): string {
  return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`
}

function parsePolyline(polyline: string): number[][] {
  if (!polyline) return []
  const out: number[][] = []
  for (const pair of polyline.split(';')) {
    const [lng, lat] = pair.split(',').map(Number)
    if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat])
  }
  return out
}

interface BicyclingStep {
  instruction?: string
  road?: string
  distance?: number
  duration?: number
  polyline?: string
  orientation?: string
  action?: string
}

interface BicyclingPath {
  distance?: number
  /** v4 uses duration; v3 riding uses time */
  duration?: number
  time?: number
  steps?: BicyclingStep[]
}

/**
 * 单段骑行规划：高德 Web 服务 v4 bicycling（失败时回退 v3 riding）。
 * 骑行接口不支持途经点，多节点路书必须分段调用再拼接。
 */
export async function planRidingSegment(
  from: CyclingLatLng,
  to: CyclingLatLng,
): Promise<CyclingSegment> {
  const key = requireKey()
  const origin = fmtCoord(from)
  const destination = fmtCoord(to)

  let path: BicyclingPath | undefined
  let lastErr = ''

  // v4 bicycling
  try {
    const url = new URL('https://restapi.amap.com/v4/direction/bicycling')
    url.searchParams.set('key', key)
    url.searchParams.set('origin', origin)
    url.searchParams.set('destination', destination)
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.errcode === 0 || data.status === '1') {
      path = (data.data?.paths ?? data.route?.paths ?? [])[0]
    } else {
      lastErr = data.errdetail || data.info || '骑行规划失败'
    }
  } catch (e) {
    lastErr = e instanceof Error ? e.message : '骑行规划请求失败'
  }

  // v3 riding fallback
  if (!path) {
    const url = new URL('https://restapi.amap.com/v3/direction/riding')
    url.searchParams.set('key', key)
    url.searchParams.set('origin', origin)
    url.searchParams.set('destination', destination)
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.status !== '1') {
      throw new Error(data.info || lastErr || '高德骑行规划异常')
    }
    path = data.route?.paths?.[0]
  }

  if (!path || !Array.isArray(path.steps) || path.steps.length === 0) {
    throw new Error(lastErr || '未规划出骑行路线（可能距离过长或不可骑行）')
  }

  const pathPts: number[][] = []
  for (const step of path.steps) {
    for (const pt of parsePolyline(step.polyline || '')) {
      const prev = pathPts[pathPts.length - 1]
      if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) pathPts.push(pt)
    }
  }

  const distance = Number(path.distance) || 0
  const duration = Number(path.duration ?? path.time) || 0
  if (!distance && pathPts.length < 2) {
    throw new Error('骑行规划结果异常，请更换起终点后重试')
  }

  return {
    fromId: '',
    toId: '',
    distance,
    duration,
    path: pathPts,
  }
}

/** 按有序有坐标节点，分段规划并拼接完整路径 */
export async function planRouteBookSegments(
  stops: { id: string; location: CyclingLatLng }[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ segments: CyclingSegment[]; plannedPath: number[][]; totalDistance: number; totalDurationSec: number }> {
  if (stops.length < 2) {
    throw new Error('至少需要起、终两个有坐标的节点')
  }

  const segments: CyclingSegment[] = []
  const plannedPath: number[][] = []
  let totalDistance = 0
  let totalDurationSec = 0
  const total = stops.length - 1

  for (let i = 0; i < total; i++) {
    onProgress?.(i, total)
    const from = stops[i]
    const to = stops[i + 1]
    const seg = await planRidingSegment(from.location, to.location)
    seg.fromId = from.id
    seg.toId = to.id
    segments.push(seg)
    totalDistance += seg.distance
    totalDurationSec += seg.duration
    for (const pt of seg.path) {
      const prev = plannedPath[plannedPath.length - 1]
      if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) plannedPath.push(pt)
    }
  }
  onProgress?.(total, total)
  return { segments, plannedPath, totalDistance, totalDurationSec }
}

const SUPPLY_KEYWORDS: Record<string, string> = {
  supply: '便利店',
  repair: '自行车维修',
  overnight: '酒店',
  checkpoint: '观景台',
  warn: '',
}

export const SUPPLY_SEARCH_PRESETS = [
  { kind: 'supply' as const, label: '补给/便利店', keywords: '便利店' },
  { kind: 'repair' as const, label: '维修', keywords: '自行车维修' },
  { kind: 'checkpoint' as const, label: '观景/景点', keywords: '观景台' },
  { kind: 'overnight' as const, label: '住宿', keywords: '酒店' },
]

/** 周边搜索（补给等）。location 为节点坐标。 */
export async function searchNearbyPois(params: {
  location: CyclingLatLng
  keywords: string
  radius?: number
}): Promise<CyclingNearbyPoi[]> {
  const key = requireKey()
  const url = new URL('https://restapi.amap.com/v3/place/around')
  url.searchParams.set('key', key)
  url.searchParams.set('location', fmtCoord(params.location))
  url.searchParams.set('keywords', params.keywords || '便利店')
  url.searchParams.set('radius', String(Math.min(50000, Math.max(100, params.radius ?? 1500))))
  url.searchParams.set('offset', '10')
  url.searchParams.set('page', '1')
  url.searchParams.set('sortrule', 'distance')
  url.searchParams.set('extensions', 'base')

  const res = await fetch(url.toString())
  const data = await res.json()
  if (data.status !== '1') {
    throw new Error(data.info || '周边搜索失败')
  }

  const pois: CyclingNearbyPoi[] = Array.isArray(data.pois) ? data.pois : []
  return pois
    .filter((p) => p.location)
    .map((p) => {
      const [lng, lat] = String(p.location).split(',').map(Number)
      return {
        id: String(p.id ?? `${lat},${lng}`),
        name: String(p.name || '未命名 POI'),
        address: p.address ? String(p.address) : undefined,
        location: { lat, lng },
        type: p.type ? String(p.type) : undefined,
        distance: p.distance != null ? Number(p.distance) : undefined,
      }
    })
    .filter((p) => Number.isFinite(p.location.lat) && Number.isFinite(p.location.lng))
}

export { SUPPLY_KEYWORDS }
