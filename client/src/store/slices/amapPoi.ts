import type { City } from '../../types'
import { fetchAmapPoiList } from '../../api/amap'
import { fetchAiPoiQuery } from '../../api/ai'
import { useLogStore } from '../logStore'
import type { SetFn, GetFn } from '../types'
import { convertAmapPois, collectTripContext } from '../utils'

export interface AmapPoiState {
  amapKeywords: string
  amapNatural: string
  amapCityName: string
}

export interface AmapPoiActions {
  setAmapKeywords: (v: string) => void
  setAmapNatural: (v: string) => void
  setAmapCityName: (name: string) => void
  fetchAmapPoi: () => Promise<void>
  fetchAmapPoiByAI: () => Promise<void>
  autoSeedPoisForCity: (city: City) => Promise<void>
}

export const initialAmapPoiState: AmapPoiState = {
  amapKeywords: '景点',
  amapNatural: '',
  amapCityName: '',
}

export function createAmapPoiActions(set: SetFn, get: GetFn): AmapPoiActions {
  return {
    setAmapKeywords: (v) => set({ amapKeywords: v }),
    setAmapNatural: (v) => set({ amapNatural: v }),
    setAmapCityName: (name) => set({ amapCityName: name }),

    fetchAmapPoi: async () => {
      const s = get()
      const cityName = s.amapCityName.trim()
      if (!cityName) { useLogStore.getState().pushLog('请先选择城市再获取高德 POI 推荐。', 'error'); return }
      const city = s.cities.find((c) => c.name === cityName)
      if (!city) { useLogStore.getState().pushLog('未找到该城市对应数据。', 'error'); return }
      const keywords = s.amapKeywords.trim() || '景点'
      useLogStore.getState().pushLog(`正在请求高德 POI：${cityName} / ${keywords}...`)
      try {
        const pois = await fetchAmapPoiList({ city: cityName, keywords, quality: 'normal' })
        if (!pois.length) { useLogStore.getState().pushLog('高德未返回结果。', 'warn'); return }
        const result = convertAmapPois(pois, city.id, get().spots, 'spot_amap')
        set({ spots: result.spots })
        useLogStore.getState().pushLog(`已将 ${result.added} 个高德 POI 加入景点池（${cityName}）。`)
        get().scheduleAiRefresh()
      } catch (e) {
        useLogStore.getState().pushLog(`高德 POI 请求失败：${e instanceof Error ? e.message : e}`, 'error')
      }
    },

    fetchAmapPoiByAI: async () => {
      const s = get()
      const cityName = s.amapCityName.trim()
      if (!cityName) { useLogStore.getState().pushLog('请先选择城市。', 'error'); return }
      const city = s.cities.find((c) => c.name === cityName)
      if (!city) { useLogStore.getState().pushLog('未找到该城市。', 'error'); return }
      const natural = s.amapNatural.trim()
      if (!natural) { useLogStore.getState().pushLog('请先描述你想找的地方。', 'error'); return }
      const trip = collectTripContext(get)
      useLogStore.getState().pushLog(`正在让 AI 帮你构建高德搜索条件：${natural}`)
      try {
        const queryResult = await fetchAiPoiQuery(natural, cityName, trip)
        const pois = await fetchAmapPoiList({ city: cityName, keywords: queryResult.keywords, quality: queryResult.quality as 'normal' | 'high', types: queryResult.types || undefined })
        if (!pois.length) { useLogStore.getState().pushLog('高德未返回结果。', 'warn'); return }
        const result = convertAmapPois(pois, city.id, get().spots, 'spot_amap_ai')
        set({ spots: result.spots })
        useLogStore.getState().pushLog(`已根据 AI+高德为 ${cityName} 加入 ${result.added} 个候选景点。`)
        get().scheduleAiRefresh()
      } catch (e) {
        useLogStore.getState().pushLog(`AI 辅助高德 POI 请求失败：${e instanceof Error ? e.message : e}`, 'error')
      }
    },

    autoSeedPoisForCity: async (city) => {
      useLogStore.getState().pushLog(`正在为新城市「${city.name}」自动获取高德推荐景点...`)
      try {
        const pois = await fetchAmapPoiList({ city: city.name, keywords: '景点', types: '110000', quality: 'high' })
        if (!pois.length) { useLogStore.getState().pushLog('自动获取高德景点失败。', 'warn'); return }
        set({ autoSeedPending: { city, pois: pois.slice(0, 6) } })
      } catch (e) {
        useLogStore.getState().pushLog(`为城市自动获取高德景点失败：${e instanceof Error ? e.message : e}`, 'error')
      }
    },
  }
}
