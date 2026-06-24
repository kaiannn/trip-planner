import type { TransportMode } from '../types'

export interface SegmentResult {
  distance: number // meters
  duration: number // seconds
  path: number[][] // [[lng,lat], ...]
}

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  driving: '驾车',
  walking: '步行',
  transit: '公交',
  riding: '骑行',
}

export const TRANSPORT_ICON: Record<TransportMode, string> = {
  driving: '🚗',
  walking: '🚶',
  transit: '🚇',
  riding: '🚴',
}

export const TRANSPORT_DASH: Record<TransportMode, 'solid' | 'dashed'> = {
  driving: 'solid',
  walking: 'dashed',
  transit: 'dashed',
  riding: 'dashed',
}

const segmentCache = new Map<string, SegmentResult>()

function cacheKey(
  mode: TransportMode,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): string {
  return `${mode}:${a.lng.toFixed(5)},${a.lat.toFixed(5)}|${b.lng.toFixed(5)},${b.lat.toFixed(5)}`
}

type RouteResult = { routes?: { distance: number; time: number; steps: { path: { lng: number; lat: number }[] }[] }[] }
type TransitResult = { plans?: { distance: number; time: number; segments?: { path?: { lng: number; lat: number }[] }[] }[] }

interface ModeConfig {
  plugin: string
  create: (AMapNs: typeof window.AMap, city?: string) => unknown
  search: (svc: unknown, from: [number, number], to: [number, number], cb: (status: string, result: unknown) => void) => void
  extract: (result: unknown, fallback: { a: { lat: number; lng: number }; b: { lat: number; lng: number } }) => SegmentResult | null
}

const ROUTE_MODES: Record<'driving' | 'walking' | 'riding', ModeConfig> = {
  driving: {
    plugin: 'Driving',
    create: (AMapNs) => new AMapNs!.Driving({ policy: 0, hideMarkers: true }),
    search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Driving>).search(from, to, cb),
    extract: (result) => {
      const r = result as RouteResult
      if (!r.routes?.length) return null
      const route = r.routes[0]
      const path: number[][] = []
      route.steps.forEach((step) => step.path.forEach((p) => path.push([p.lng, p.lat])))
      return { distance: route.distance, duration: route.time, path }
    },
  },
  walking: {
    plugin: 'Walking',
    create: (AMapNs) => new AMapNs!.Walking({ hideMarkers: true }),
    search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Walking>).search(from, to, cb),
    extract: (result) => {
      const r = result as RouteResult
      if (!r.routes?.length) return null
      const route = r.routes[0]
      const path: number[][] = []
      route.steps.forEach((step) => step.path.forEach((p) => path.push([p.lng, p.lat])))
      return { distance: route.distance, duration: route.time, path }
    },
  },
  riding: {
    plugin: 'Riding',
    create: (AMapNs) => new AMapNs!.Riding({ hideMarkers: true }),
    search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Riding>).search(from, to, cb),
    extract: (result) => {
      const r = result as RouteResult
      if (!r.routes?.length) return null
      const route = r.routes[0]
      const path: number[][] = []
      route.steps.forEach((step) => step.path.forEach((p) => path.push([p.lng, p.lat])))
      return { distance: route.distance, duration: route.time, path }
    },
  },
}

const TRANSIT_CONFIG: ModeConfig = {
  plugin: 'Transfer',
  create: (AMapNs, city) => new AMapNs!.Transfer({ city: city || '全国', hideMarkers: true }),
  search: (svc, from, to, cb) => (svc as InstanceType<typeof window.AMap.Transfer>).search(from, to, cb),
  extract: (result, fallback) => {
    const r = result as TransitResult
    if (!r.plans?.length) return null
    const plan = r.plans[0]
    const path: number[][] = []
    plan.segments?.forEach((seg) => seg.path?.forEach((p) => path.push([p.lng, p.lat])))
    if (path.length < 2) path.push([fallback.a.lng, fallback.a.lat], [fallback.b.lng, fallback.b.lat])
    return { distance: plan.distance, duration: plan.time, path }
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

  return new Promise((resolve, reject) => {
    const svc = config.create(AMapNs, city)
    config.search(svc, [a.lng, a.lat], [b.lng, b.lat], (status: string, result: unknown) => {
      if (status !== 'complete') {
        reject(new Error((result as { info?: string })?.info ?? `no ${config.plugin} route`))
        return
      }
      const out = config.extract(result, { a, b })
      if (!out) {
        reject(new Error((result as { info?: string })?.info ?? `no ${config.plugin} route`))
        return
      }
      segmentCache.set(cacheKeyStr, out)
      resolve(out)
    })
  })
}

/**
 * Routes a single segment between two coords using one of AMap's four
 * routing services. Caches by (mode + rounded coords) so re-renders
 * and mode comparisons don't repeatedly hit the API.
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

  if (mode === 'transit') {
    return routeVia(TRANSIT_CONFIG, a, b, key, opts.city)
  }

  return routeVia(ROUTE_MODES[mode], a, b, key)
}

/** Fetch all four modes for one segment in parallel; rejected promises become null. */
export async function fetchAllModes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  opts: { city?: string } = {},
): Promise<Record<TransportMode, SegmentResult | null>> {
  const modes: TransportMode[] = ['driving', 'walking', 'transit', 'riding']
  const results = await Promise.all(
    modes.map((m) => fetchSegment(m, a, b, opts).catch(() => null)),
  )
  return {
    driving: results[0],
    walking: results[1],
    transit: results[2],
    riding: results[3],
  }
}
