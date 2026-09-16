import { requireAmapWebServiceKey } from '../lib/amapKey'

export interface AmapPhoto {
  title?: string
  url?: string
}

export interface AmapPoi {
  id?: string
  name?: string
  location?: string
  address?: string
  type?: string
  rating?: string | number
  cost?: string
  tel?: string
  opentime_week?: string
  biz_ext?: { rating?: string | number }
  business?: {
    rating?: string
    cost?: string
    tel?: string
    opentime_week?: string
    opentime_today?: string
  }
  photos?: AmapPhoto[] | AmapPhoto
}

/** Normalize AMap photo URL: protocol-relative → https, trim, force https (mixed-content). */
function normalizePhotoUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let u = raw.trim()
  if (!u) return undefined
  if (u.startsWith('//')) u = `https:${u}`
  if (!/^https?:\/\//i.test(u)) return undefined
  // AMap returns http://store.is.autonavi.com/... — browsers block mixed content on HTTPS pages
  if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, 'https://')
  return u
}

function photoUrlFromEntry(p: AmapPhoto | string | undefined): string | undefined {
  if (!p) return undefined
  if (typeof p === 'string') return normalizePhotoUrl(p)
  return normalizePhotoUrl(p.url)
}

export function pickPoiPhoto(poi: Pick<AmapPoi, 'photos'>): string | undefined {
  const list = Array.isArray(poi.photos) ? poi.photos : poi.photos ? [poi.photos] : []
  const urls: string[] = []
  for (const p of list) {
    const u = photoUrlFromEntry(p as AmapPhoto | string)
    if (u) urls.push(u)
  }
  return urls[0]
}

function parseV5Poi(raw: Record<string, unknown>): AmapPoi {
  const photos = raw.photos as AmapPoi['photos'] | undefined
  const business = raw.business as AmapPoi['business'] | undefined
  return {
    id: raw.id as string | undefined,
    name: raw.name as string | undefined,
    location: raw.location as string | undefined,
    address: raw.address as string | undefined,
    type: raw.type as string | undefined,
    rating: (raw.rating as string | undefined) ?? business?.rating,
    cost: (raw.cost as string | undefined) ?? business?.cost,
    tel: business?.tel,
    opentime_week: business?.opentime_week,
    business,
    photos,
  }
}

/**
 * POI search with photos + business when possible.
 * Prefer v5 `show_fields=photos,business`; fall back to v3.
 */
export async function fetchAmapPoiList(params: {
  city: string
  keywords: string
  quality?: string
  types?: string
}): Promise<AmapPoi[]> {
  const key = requireAmapWebServiceKey()

  let pois: AmapPoi[] = []

  // v5 — explicit photos / business
  try {
    const url = new URL('https://restapi.amap.com/v5/place/text')
    url.searchParams.set('key', key)
    url.searchParams.set('keywords', params.keywords)
    url.searchParams.set('region', params.city)
    url.searchParams.set('city_limit', 'true')
    url.searchParams.set('page_size', '20')
    url.searchParams.set('page_num', '1')
    if (params.types) url.searchParams.set('types', params.types)
    url.searchParams.set('show_fields', 'photos,business')
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.pois && Array.isArray(data.pois)) {
      pois = data.pois.map((p: Record<string, unknown>) => parseV5Poi(p))
    }
  } catch {
    pois = []
  }

  // v3 fallback / merge if v5 empty
  if (!pois.length) {
    const url = new URL('https://restapi.amap.com/v3/place/text')
    url.searchParams.set('key', key)
    url.searchParams.set('keywords', params.keywords)
    url.searchParams.set('city', params.city)
    url.searchParams.set('citylimit', 'true')
    url.searchParams.set('offset', '20')
    url.searchParams.set('page', '1')
    if (params.types) url.searchParams.set('types', params.types)
    url.searchParams.set('extensions', 'all')
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.status !== '1') {
      throw new Error(data.info || '高德接口异常')
    }
    pois = Array.isArray(data.pois) ? data.pois : []
  }

  if (params.quality === 'high' && pois.length) {
    pois = pois.slice().sort((a, b) => {
      const ra = Number(a.biz_ext?.rating || a.rating || 0)
      const rb = Number(b.biz_ext?.rating || b.rating || 0)
      return rb - ra
    }).slice(0, 20)
  }

  return pois
}

/** Detail by poi id — richer photos / business. */
export async function fetchAmapPoiDetail(poiId: string): Promise<AmapPoi | null> {
  const key = requireAmapWebServiceKey()
  // v5 detail first
  try {
    const url = new URL('https://restapi.amap.com/v5/place/detail')
    url.searchParams.set('key', key)
    url.searchParams.set('id', poiId)
    url.searchParams.set('show_fields', 'photos,business')
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.pois?.[0]) return parseV5Poi(data.pois[0])
  } catch {
    /* fall through */
  }
  const url = new URL('https://restapi.amap.com/v3/place/detail')
  url.searchParams.set('key', key)
  url.searchParams.set('id', poiId)
  url.searchParams.set('extensions', 'all')
  try {
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.status !== '1') return null
    return (Array.isArray(data.pois) && data.pois[0]) || null
  } catch {
    return null
  }
}
