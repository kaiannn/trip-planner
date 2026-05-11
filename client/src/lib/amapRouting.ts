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
  // AMap.Polyline only supports 'solid' | 'dashed'. We layer style hints
  // beyond that via strokeOpacity / strokeWeight in the renderer.
  driving: 'solid',
  walking: 'dashed',
  transit: 'dashed',
  riding: 'dashed',
}

const segmentCache = new Map<string, SegmentResult>()

/** Build a deterministic cache key for one segment under a given mode. */
function cacheKey(
  mode: TransportMode,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): string {
  return `${mode}:${a.lng.toFixed(5)},${a.lat.toFixed(5)}|${b.lng.toFixed(5)},${b.lat.toFixed(5)}`
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

  const AMapNs = typeof window !== 'undefined' ? window.AMap : undefined
  if (!AMapNs) return Promise.reject(new Error('AMap not loaded'))

  if (mode === 'driving') {
    if (!AMapNs.Driving) {
      return Promise.reject(new Error('AMap.Driving plugin not loaded'))
    }
    return new Promise((resolve, reject) => {
      const svc = new AMapNs.Driving({ policy: 0, hideMarkers: true })
      svc.search([a.lng, a.lat], [b.lng, b.lat], (status, result) => {
        if (status !== 'complete' || !result.routes?.length) {
          reject(new Error(result?.info ?? 'no route'))
          return
        }
        const route = result.routes[0]
        const path: number[][] = []
        route.steps.forEach((step) => {
          step.path.forEach((p) => path.push([p.lng, p.lat]))
        })
        const out: SegmentResult = {
          distance: route.distance,
          duration: route.time,
          path,
        }
        segmentCache.set(key, out)
        resolve(out)
      })
    })
  }

  if (mode === 'walking') {
    if (!AMapNs.Walking) {
      return Promise.reject(new Error('AMap.Walking plugin not loaded'))
    }
    return new Promise((resolve, reject) => {
      const svc = new AMapNs.Walking({ hideMarkers: true })
      svc.search([a.lng, a.lat], [b.lng, b.lat], (status, result) => {
        if (status !== 'complete' || !result.routes?.length) {
          reject(new Error(result?.info ?? 'no walking route'))
          return
        }
        const route = result.routes[0]
        const path: number[][] = []
        route.steps.forEach((step) => {
          step.path.forEach((p) => path.push([p.lng, p.lat]))
        })
        const out: SegmentResult = {
          distance: route.distance,
          duration: route.time,
          path,
        }
        segmentCache.set(key, out)
        resolve(out)
      })
    })
  }

  if (mode === 'riding') {
    if (!AMapNs.Riding) {
      return Promise.reject(new Error('AMap.Riding plugin not loaded'))
    }
    return new Promise((resolve, reject) => {
      const svc = new AMapNs.Riding({ hideMarkers: true })
      svc.search([a.lng, a.lat], [b.lng, b.lat], (status, result) => {
        if (status !== 'complete' || !result.routes?.length) {
          reject(new Error(result?.info ?? 'no riding route'))
          return
        }
        const route = result.routes[0]
        const path: number[][] = []
        route.steps.forEach((step) => {
          step.path.forEach((p) => path.push([p.lng, p.lat]))
        })
        const out: SegmentResult = {
          distance: route.distance,
          duration: route.time,
          path,
        }
        segmentCache.set(key, out)
        resolve(out)
      })
    })
  }

  // transit
  if (!AMapNs.Transfer) {
    return Promise.reject(new Error('AMap.Transfer plugin not loaded'))
  }
  return new Promise((resolve, reject) => {
    const svc = new AMapNs.Transfer({
      city: opts.city || '全国',
      hideMarkers: true,
    })
    svc.search([a.lng, a.lat], [b.lng, b.lat], (status, result) => {
      if (status !== 'complete' || !result.plans?.length) {
        reject(new Error(result?.info ?? 'no transit plan'))
        return
      }
      const plan = result.plans[0]
      const path: number[][] = []
      plan.segments?.forEach((seg) => {
        seg.path?.forEach((p) => path.push([p.lng, p.lat]))
      })
      // Fallback: if no path stitched (rare), draw a straight line.
      if (path.length < 2) {
        path.push([a.lng, a.lat], [b.lng, b.lat])
      }
      const out: SegmentResult = {
        distance: plan.distance,
        duration: plan.time,
        path,
      }
      segmentCache.set(key, out)
      resolve(out)
    })
  })
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
