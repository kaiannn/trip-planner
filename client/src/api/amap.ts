import { getUserHeaders } from '../store/settingsStore'

export interface AmapPoi {
  name?: string
  location?: string
  address?: string
  type?: string
  rating?: string | number
  biz_ext?: { rating?: string | number }
}

export async function fetchAmapPoiList(params: {
  city: string
  keywords: string
  quality?: string
  types?: string
}): Promise<AmapPoi[]> {
  const url = new URL('/api/amap/poi', window.location.origin)
  url.searchParams.set('city', params.city)
  url.searchParams.set('keywords', params.keywords)
  if (params.quality) url.searchParams.set('quality', params.quality)
  if (params.types) url.searchParams.set('types', params.types)
  const res = await fetch(url.toString(), { headers: getUserHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `请求失败 ${res.status}`)
  return Array.isArray(data.pois) ? data.pois : []
}
