import { useSettingsStore } from '../store/settingsStore'

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
  const key = useSettingsStore.getState().amapWebServiceKey
  if (!key) throw new Error('未配置高德 Web 服务 Key，请在设置中填写。')

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
    const msg = data.info || '高德接口异常'
    throw new Error(msg)
  }

  let pois: AmapPoi[] = Array.isArray(data.pois) ? data.pois : []

  if (params.quality === 'high' && pois.length) {
    pois = pois.slice().sort((a, b) => {
      const ra = Number(a.biz_ext?.rating || a.rating || 0)
      const rb = Number(b.biz_ext?.rating || b.rating || 0)
      return rb - ra
    }).slice(0, 20)
  }

  return pois
}
