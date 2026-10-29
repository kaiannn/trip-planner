import type { TransportMode } from '../types'
import { distanceInMeters } from './geo'

export interface SegmentResult {
  distance: number // meters
  duration: number // seconds
  path: number[][] // [[lng,lat], ...]
  /** True when geometry/duration are straight-line estimates, not road routes. */
  estimated?: boolean
  /** e.g. "步行 320m · 地铁1号线 · 步行 150m" for public transit. */
  summary?: string
}

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  driving: '驾车',
  walking: '步行',
  transit: '公共交通',
}

export const TRANSPORT_ICON: Record<TransportMode, string> = {
  driving: '🚗',
  walking: '🚶',
  transit: '🚇',
}

export const TRANSPORT_DASH: Record<TransportMode, 'solid' | 'dashed'> = {
  driving: 'solid',
  walking: 'dashed',
  transit: 'dashed',
}

/** Rough avg speeds (m/s) for straight-line estimates when AMap returns no route. */
const ESTIMATE_SPEED_MPS: Record<TransportMode, number> = {
  driving: 11, // ~40 km/h city
  walking: 1.3, // ~4.7 km/h
  transit: 7, // ~25 km/h incl. waits
}

/** How much longer road distance is vs great-circle, per mode. */
const ESTIMATE_ROAD_FACTOR: Record<TransportMode, number> = {
  driving: 1.3,
  walking: 1.25,
  transit: 1.3,
}

/** Beyond this, straight-line estimate is more misleading than useful. */
const ESTIMATE_MAX_M: Record<TransportMode, number> = {
  driving: 2_000_000,
  walking: 50_000,
  transit: 400_000,
}

const segmentCache = new Map<string, SegmentResult>()

function cacheKey(
  mode: TransportMode,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): string {
  return `${mode}:${a.lng.toFixed(5)},${a.lat.toFixed(5)}|${b.lng.toFixed(5)},${b.lat.toFixed(5)}`
}

/** Straight-line fallback so the popup can still offer a usable estimate. */
export function estimateSegment(
  mode: TransportMode,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): SegmentResult | null {
  const meters = distanceInMeters(a.lat, a.lng, b.lat, b.lng)
  if (!Number.isFinite(meters) || meters <= 0) return null
  if (meters > ESTIMATE_MAX_M[mode]) return null
  const distance = Math.round(meters * ESTIMATE_ROAD_FACTOR[mode])
  const duration = Math.max(60, Math.round(distance / ESTIMATE_SPEED_MPS[mode]))
  return {
    distance,
    duration,
    path: [[a.lng, a.lat], [b.lng, b.lat]],
    estimated: true,
  }
}

type RouteResult = {
  routes?: {
    distance?: number
    time?: number
    path?: PathPoint[]
    steps?: { path?: PathPoint[] }[]
  }[]
}

/** Flatten Driving/Walking/Riding steps (or a route-level path) into [[lng,lat],…]. */
function extractRoadRoute(result: unknown): SegmentResult | null {
  const r = result as RouteResult
  if (!r.routes?.length) return null
  const route = r.routes[0]
  const path: number[][] = []
  for (const step of route.steps ?? []) {
    pushPathPoints(path, step.path)
  }
  // Some payloads put geometry on the route itself
  if (path.length < 2) pushPathPoints(path, route.path)
  if (path.length < 2) return null
  return {
    distance: Number(route.distance) || 0,
    duration: Number(route.time) || 0,
    path,
  }
}

type PathPoint = { lng: number; lat: number } | [number, number]
type PathLike = PathPoint[] | undefined | null

/** AMap Transfer nests the geometry under walking/bus/railway/taxi — not on the segment itself. */
type TransitBusLine = {
  name?: string
  type?: string | number
  path?: PathLike
}
type TransitSegment = {
  walking?: { path?: PathLike; distance?: number }
  bus?: { lines?: TransitBusLine[] }
  railway?: { path?: PathLike; name?: string; type?: string | number }
  taxi?: { path?: PathLike; distance?: number }
  riding?: { path?: PathLike; distance?: number; name?: string }
  path?: PathLike
}
type TransitResult = {
  plans?: {
    distance?: number
    time?: number
    segments?: TransitSegment[]
  }[]
}

function pushPathPoints(out: number[][], path: PathLike) {
  if (!Array.isArray(path)) return
  for (const p of path) {
    if (!p) continue
    if (Array.isArray(p)) {
      const [lng, lat] = p
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat])
    } else if (Number.isFinite(p.lng) && Number.isFinite(p.lat)) {
      out.push([p.lng, p.lat])
    }
  }
}

function formatLegMeters(m: number | undefined): string | null {
  if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

/** Build "步行 320m · 地铁1号线 · 公交18路" style summary from Transfer segments. */
function buildTransitSummary(segments: TransitSegment[] | undefined): string | undefined {
  if (!segments?.length) return undefined
  const parts: string[] = []
  for (const seg of segments) {
    if (seg.walking) {
      const m = formatLegMeters(seg.walking.distance)
      if (m) parts.push(`步行 ${m}`)
    }
    if (seg.railway?.name) parts.push(seg.railway.name)
    for (const line of seg.bus?.lines ?? []) {
      if (line.name) parts.push(line.name)
    }
    if (seg.riding) {
      const m = formatLegMeters(seg.riding.distance)
      const name = seg.riding.name
      parts.push(name ? (m ? `${name} ${m}` : name) : m ? `骑行 ${m}` : '骑行')
    }
    if (seg.taxi) {
      const m = formatLegMeters(seg.taxi.distance)
      if (m) parts.push(`打车 ${m}`)
    }
  }
  // de-dupe consecutive identical parts (walking before/after same station)
  const compact = parts.filter((p, i) => i === 0 || p !== parts[i - 1])
  return compact.length ? compact.join(' · ') : undefined
}

interface ModeConfig {
  plugin: string
  create: (AMapNs: typeof window.AMap, city?: string) => unknown
  search: (svc: unknown, from: [number, number], to: [number, number], cb: (status: string, result: unknown) => void) => void
  extract: (result: unknown, fallback: { a: { lat: number; lng: number }; b: { lat: number; lng: number } }) => SegmentResult | null
}

const ROUTE_MODES: Record<'driving' | 'walking', ModeConfig> = {
  driving: {
    plugin: 'Driving',
    create: (AMapNs) => new AMapNs!.Driving({ policy: 0, hideMarkers: true }),
    search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Driving>).search(from, to, cb),
    extract: extractRoadRoute,
  },
  walking: {
    plugin: 'Walking',
    create: (AMapNs) => new AMapNs!.Walking({ hideMarkers: true }),
    search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Walking>).search(from, to, cb),
    extract: extractRoadRoute,
  },
}

const TRANSIT_CONFIG: ModeConfig = {
  plugin: 'Transfer',
  // cityrlt:false lets Transfer search beyond a strict city boundary
  // (nearby districts / cross-city transit often fail with cityrlt default).
  create: (AMapNs, city) =>
    new AMapNs!.Transfer({ city: city || '全国', cityrlt: false, hideMarkers: true }),
  search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Transfer>).search(from, to, cb),
  extract: (result, fallback) => {
    const r = result as TransitResult
    if (!r?.plans?.length) return null
    const plan = r.plans[0]
    const path: number[][] = []
    plan.segments?.forEach((seg) => {
      // Real TransferResult nests path under walking / bus.lines / railway / taxi
      pushPathPoints(path, seg.walking?.path)
      seg.bus?.lines?.forEach((line) => pushPathPoints(path, line.path))
      pushPathPoints(path, seg.railway?.path)
      pushPathPoints(path, seg.taxi?.path)
      pushPathPoints(path, seg.path)
    })
    if (path.length < 2) {
      path.length = 0
      path.push([fallback.a.lng, fallback.a.lat], [fallback.b.lng, fallback.b.lat])
    }
    return {
      distance: plan.distance ?? 0,
      duration: plan.time ?? 0,
      path,
      summary: buildTransitSummary(plan.segments),
    }
  },
}

function routeVia(
  config: ModeConfig,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  cacheKeyStr: string,
  city?: string,
): Promise<SegmentResult> {
  const AMapNs = typeof window !== 'undefined' ? window.AMap : undefined
  if (!AMapNs) return Promise.reject(new Error('AMap not loaded'))

  const pluginKey = config.plugin as keyof typeof AMapNs
  if (!AMapNs[pluginKey]) {
    return Promise.reject(new Error(`AMap.${config.plugin} plugin not loaded`))
  }

  const attempt = (cityOverride?: string): Promise<SegmentResult> =>
    new Promise((resolve, reject) => {
      const svc = config.create(AMapNs, cityOverride)
      config.search(svc, [a.lng, a.lat], [b.lng, b.lat], (status: string, result: unknown) => {
        if (status !== 'complete') {
          reject(new Error((result as { info?: string })?.info ?? `no ${config.plugin} route`))
          return
        }
        let out: SegmentResult | null = null
        try {
          out = config.extract(result, { a, b })
        } catch {
          out = null
        }
        if (!out || !Array.isArray(out.path) || out.path.length < 2) {
          reject(new Error((result as { info?: string })?.info ?? `no ${config.plugin} route`))
          return
        }
        resolve(out)
      })
    })

  // Transit: if city-scoped search fails, retry city-agnostic once.
  const run = async (): Promise<SegmentResult> => {
    try {
      return await attempt(city)
    } catch (err) {
      if (config.plugin === 'Transfer' && city) {
        try {
          return await attempt(undefined)
        } catch {
          throw err
        }
      }
      throw err
    }
  }

  return run().then((out) => {
    segmentCache.set(cacheKeyStr, out)
    return out
  })
}

/**
 * Routes a single segment between two coords using one of AMap's four
 * routing services. Caches by (mode + rounded coords) so re-renders
 * and mode comparisons don't repeatedly hit the API.
 *
 * On API miss (too far / no road path / Transfer no_data), falls back to a
 * straight-line estimate when the distance is still plausible for that mode —
 * so the UI can offer walking/transit instead of a hard "不可达".
 */
export function fetchSegment(
  mode: TransportMode,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  opts: { city?: string } = {},
): Promise<SegmentResult> {
  const key = cacheKey(mode, a, b)
  const cached = segmentCache.get(key)
  if (cached) return Promise.resolve(cached)

  const request =
    mode === 'transit'
      ? routeVia(TRANSIT_CONFIG, a, b, key, opts.city)
      : routeVia(ROUTE_MODES[mode], a, b, key)

  return request.catch((err: unknown) => {
    const est = estimateSegment(mode, a, b)
    if (est) return est
    throw err
  })
}

/** Fetch the three offered modes for one segment in parallel; rejected promises become null. */
export async function fetchAllModes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  opts: { city?: string } = {},
): Promise<Record<TransportMode, SegmentResult | null>> {
  const modes: TransportMode[] = ['driving', 'walking', 'transit']
  const results = await Promise.all(
    modes.map((m) => fetchSegment(m, a, b, opts).catch(() => null)),
  )
  return {
    driving: results[0],
    walking: results[1],
    transit: results[2],
  }
}
