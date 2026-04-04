import { create } from 'zustand'
import { buildAiPrompt, type TripContextPayload } from '../lib/aiPrompt'
import { buildTripProfileFromTags } from '../lib/tripProfile'
import { isDuplicateSpot } from '../lib/geo'
import type {
  AiFocus,
  AiItem,
  AiSection,
  City,
  DailyPlan,
  LogEntry,
  LogLevel,
  Spot,
} from '../types'

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

interface TripState {
  cities: City[]
  spots: Spot[]
  dailyPlans: DailyPlan[]
  tripTitle: string
  tripStart: string
  tripEnd: string
  tripExpectation: string
  tripType: string
  aiCityId: string
  aiBudget: string
  aiStatus: string
  aiPromptText: string
  aiSections: AiSection[]
  logs: LogEntry[]
  spotPoolOpen: boolean
  dayPlanOpen: boolean
  tripWizardOpen: boolean
  spotDetailSpot: Spot | null
  poolCityFilter: string
  amapKeywords: string
  amapNatural: string
  amapCityName: string
  pendingMapCoords: { lat: number; lng: number } | null
  mapFocusDayId: string | null
  tripQuizPath: string[]
  tripQuizTags: string[]
  quizNodeId: string
  quizPhase: 'question' | 'result'
  aiRefreshTimer: ReturnType<typeof setTimeout> | null
  mapRedrawNonce: number
}

function makeLog(message: string, level: LogLevel): LogEntry {
  return {
    id: uid('log'),
    time: new Date().toLocaleTimeString(),
    level,
    message,
  }
}

function collectTripContext(get: () => TripState & TripActions): TripContextPayload {
  const s = get()
  return {
    title: s.tripTitle,
    startDate: s.tripStart,
    endDate: s.tripEnd,
    travelExpectation: s.tripExpectation.trim(),
    tripType: s.tripType,
    cities: s.cities,
    spots: s.spots,
    dailyPlans: s.dailyPlans,
  }
}

type TripActions = {
  pushLog: (message: string, level?: LogLevel) => void
  setTripField: (
    field: keyof Pick<TripState, 'tripTitle' | 'tripStart' | 'tripEnd' | 'tripExpectation' | 'tripType'>,
    value: string,
  ) => void
  setAiCityId: (id: string) => void
  setAiBudget: (v: string) => void
  setSpotPoolOpen: (v: boolean) => void
  setDayPlanOpen: (v: boolean) => void
  setTripWizardOpen: (v: boolean) => void
  setSpotDetail: (s: Spot | null) => void
  setPoolCityFilter: (v: string) => void
  setAmapKeywords: (v: string) => void
  setAmapNatural: (v: string) => void
  setAmapCityName: (name: string) => void
  setPendingMapCoords: (c: { lat: number; lng: number } | null) => void
  setMapFocusDayId: (id: string | null) => void
  addCity: (name: string, lat?: number, lng?: number) => City
  updateCityLocation: (cityId: string, lat: number, lng: number) => void
  moveCity: (cityId: string, delta: number) => void
  deleteCity: (cityId: string) => void
  addSpot: (spot: Omit<Spot, 'id'>) => boolean
  removeSpot: (spotId: string) => void
  saveDay: (payload: {
    dayIndex: number
    cityId: string
    date?: string
    lodging: { name?: string; address?: string }
    spotOrder: string[]
    transportMode?: string
  }) => void
  deleteDay: (dayId: string) => void
  setDaySpotOrder: (dayId: string, spotOrder: string[]) => void
  requestAiRecommendations: (focus?: AiFocus) => Promise<void>
  /** 地图重绘 + 合理性检查 + 全量 AI（与单次点「推荐」共用同一套上下文） */
  syncTripIntelligence: () => Promise<void>
  scheduleAiRefresh: () => void
  applyAiSpotItem: (item: AiItem) => void
  applyAiLodgingItem: (item: AiItem) => void
  fetchAmapPoi: () => Promise<void>
  fetchAmapPoiByAI: () => Promise<void>
  autoSeedPoisForCity: (city: City) => Promise<void>
  extendDaySpotsByAI: (dayId: string) => Promise<void>
  runReasonablenessChecks: () => void
  resetQuiz: () => void
  setQuizNode: (id: string) => void
  selectQuizOption: (tags: string[], nextId: string | null) => void
  quizGoPrev: () => void
  quizBackFromResult: () => void
  appendExpectationFromQuiz: () => void
  bumpMapRedraw: () => void
}

export const useTripStore = create<TripState & TripActions>((set, get) => ({
  cities: [],
  spots: [],
  dailyPlans: [],
  tripTitle: '',
  tripStart: '',
  tripEnd: '',
  tripExpectation: '',
  tripType: '',
  aiCityId: '',
  aiBudget: '',
  aiStatus: '未请求',
  aiPromptText: '',
  aiSections: [],
  logs: [],
  spotPoolOpen: false,
  dayPlanOpen: false,
  tripWizardOpen: false,
  spotDetailSpot: null,
  poolCityFilter: '',
  amapKeywords: '景点',
  amapNatural: '',
  amapCityName: '',
  pendingMapCoords: null,
  mapFocusDayId: null,
  tripQuizPath: [],
  tripQuizTags: [],
  quizNodeId: 'q_length',
  quizPhase: 'question',
  aiRefreshTimer: null,
  mapRedrawNonce: 0,

  bumpMapRedraw: () => set((s) => ({ mapRedrawNonce: s.mapRedrawNonce + 1 })),

  pushLog: (message, level = 'info') => {
    set((s) => ({ logs: [makeLog(message, level), ...s.logs].slice(0, 200) }))
  },

  setTripField: (field, value) => set({ [field]: value } as Partial<TripState>),
  setAiCityId: (id) => set({ aiCityId: id }),
  setAiBudget: (v) => set({ aiBudget: v }),
  setSpotPoolOpen: (v) => set({ spotPoolOpen: v }),
  setDayPlanOpen: (v) => set({ dayPlanOpen: v }),
  setTripWizardOpen: (v) => set({ tripWizardOpen: v }),
  setSpotDetail: (spot) => set({ spotDetailSpot: spot }),
  setPoolCityFilter: (v) => set({ poolCityFilter: v }),
  setAmapKeywords: (v) => set({ amapKeywords: v }),
  setAmapNatural: (v) => set({ amapNatural: v }),
  setAmapCityName: (name) => set({ amapCityName: name }),
  setPendingMapCoords: (c) => set({ pendingMapCoords: c }),
  setMapFocusDayId: (id) => set({ mapFocusDayId: id }),

  addCity: (name, lat, lng) => {
    const city: City = {
      id: uid('city'),
      name: name.trim(),
      order: get().cities.length,
    }
    if (lat !== undefined && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      city.location = { lat, lng }
    }
    set((s) => ({ cities: [...s.cities, city] }))
    get().pushLog(`已添加城市：${city.name}`)
    return city
  },

  updateCityLocation: (cityId, lat, lng) => {
    set((s) => ({
      cities: s.cities.map((c) =>
        c.id === cityId ? { ...c, location: { lat, lng } } : c,
      ),
    }))
  },

  moveCity: (cityId, delta) => {
    const cities = [...get().cities]
    const index = cities.findIndex((c) => c.id === cityId)
    if (index === -1) return
    const newIndex = index + delta
    if (newIndex < 0 || newIndex >= cities.length) return
    ;[cities[index], cities[newIndex]] = [cities[newIndex], cities[index]]
    cities.forEach((c, i) => {
      c.order = i
    })
    set({ cities })
    get().scheduleAiRefresh()
  },

  deleteCity: (cityId) => {
    set((s) => ({
      cities: s.cities.filter((c) => c.id !== cityId),
      spots: s.spots.filter((sp) => sp.cityId !== cityId),
      dailyPlans: s.dailyPlans.filter((d) => d.cityId !== cityId),
    }))
    get().pushLog('已删除城市及其关联的景点和行程', 'warn')
    get().scheduleAiRefresh()
  },

  addSpot: (spotData) => {
    const { spots } = get()
    if (
      isDuplicateSpot(
        spots,
        spotData.cityId,
        spotData.name,
        spotData.location.lat,
        spotData.location.lng,
      )
    ) {
      get().pushLog('该景点在当前城市中已经存在或位置非常接近，已自动跳过重复添加。', 'warn')
      return false
    }
    const spot: Spot = { ...spotData, id: uid('spot') }
    set((s) => ({ spots: [...s.spots, spot] }))
    get().pushLog(`已添加景点：${spot.name}`)
    get().scheduleAiRefresh()
    return true
  },

  removeSpot: (spotId) => {
    set((s) => ({
      spots: s.spots.filter((x) => x.id !== spotId),
      dailyPlans: s.dailyPlans.map((d) => ({
        ...d,
        spotOrder: d.spotOrder.filter((sid) => sid !== spotId),
      })),
    }))
    get().scheduleAiRefresh()
  },

  saveDay: ({ dayIndex, cityId, date, lodging, spotOrder, transportMode }) => {
    const plans = [...get().dailyPlans]
    const existingIndex = plans.findIndex((d) => d.dayIndex === dayIndex)
    if (existingIndex >= 0) {
      plans[existingIndex] = {
        ...plans[existingIndex],
        cityId,
        date,
        lodging,
        spotOrder,
        transportMode,
      }
      get().pushLog(`已更新第 ${dayIndex} 天行程`)
    } else {
      plans.push({
        id: uid('day'),
        dayIndex,
        cityId,
        date,
        lodging,
        spotOrder,
        transportMode,
      })
      get().pushLog(`已保存第 ${dayIndex} 天行程`)
    }
    set({ dailyPlans: plans })
    get().scheduleAiRefresh()
  },

  deleteDay: (dayId) => {
    set((s) => ({ dailyPlans: s.dailyPlans.filter((d) => d.id !== dayId) }))
    get().scheduleAiRefresh()
  },

  setDaySpotOrder: (dayId, spotOrder) => {
    set((s) => ({
      dailyPlans: s.dailyPlans.map((d) =>
        d.id === dayId ? { ...d, spotOrder } : d,
      ),
    }))
    get().scheduleAiRefresh()
  },

  requestAiRecommendations: async (focus: AiFocus = 'all') => {
    const s = get()
    const focusCityId = s.aiCityId || s.cities[0]?.id || ''
    const budgetPerDay = parseFloat(s.aiBudget) || 0
    const trip = collectTripContext(get)
    const prompt = buildAiPrompt({ trip, focusCityId, budgetPerDay, focus })
    set({
      aiStatus: '正在向后端请求 AI 推荐...',
      aiPromptText: prompt,
      aiSections: [],
    })
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const sections = Array.isArray(data.sections) ? data.sections : []
      set({
        aiSections: sections,
        aiStatus: sections.length
          ? '已根据当前行程生成 AI 推荐。'
          : 'AI 没有返回可用的推荐，请适当调整行程后重试。',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ aiStatus: `请求失败：${msg}` })
      get().pushLog(
        `AI 推荐请求失败：${msg}。请检查后端 /api/ai/recommend 是否已启动以及 API Key 是否填写。`,
        'error',
      )
    }
  },

  syncTripIntelligence: async () => {
    get().bumpMapRedraw()
    get().runReasonablenessChecks()
    await get().requestAiRecommendations('all')
  },

  scheduleAiRefresh: () => {
    const t = get().aiRefreshTimer
    if (t) clearTimeout(t)
    set({ aiStatus: '行程有改动，将自动更新推荐…' })
    const timer = setTimeout(() => {
      get().requestAiRecommendations('all')
      set({ aiRefreshTimer: null })
    }, 1500)
    set({ aiRefreshTimer: timer })
  },

  applyAiSpotItem: (item) => {
    const s = get()
    const cityId = s.aiCityId || s.cities[0]?.id || ''
    const city = s.cities.find((c) => c.id === cityId)
    if (!city) {
      get().pushLog('无法应用景点：当前没有可用城市。', 'error')
      return
    }
    const lat = typeof item.lat === 'number' ? item.lat : city.location?.lat
    const lng = typeof item.lng === 'number' ? item.lng : city.location?.lng
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      get().pushLog('AI 推荐景点未提供坐标，且城市也没有坐标，无法放到地图上。', 'warn')
    }
    const spot: Spot = {
      id: uid('spot_ai'),
      cityId: city.id,
      name: item.title || 'AI 推荐景点',
      location: { lat: lat ?? 0, lng: lng ?? 0 },
      guideUrl: item.guideUrl,
      visitTimeText: item.summary,
      innerTransport: item.innerTransport,
    }
    set((st) => ({ spots: [...st.spots, spot] }))
    get().pushLog(`已将 AI 推荐景点加入：${item.title || 'AI 推荐景点'}`)
    get().scheduleAiRefresh()
  },

  applyAiLodgingItem: (item) => {
    const s = get()
    const cityId = s.aiCityId || s.cities[0]?.id || ''
    const cityDays = s.dailyPlans
      .slice()
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .filter((d) => d.cityId === cityId)
    const targetDay = cityDays.find((d) => !d.lodging?.name) || cityDays[0]
    if (!targetDay) {
      get().pushLog('当前城市没有对应的每日行程，无法填入住宿。', 'warn')
      return
    }
    const lodging = {
      name: item.title || 'AI 推荐住宿',
      address: item.meta || item.detail || item.summary || '',
    }
    set((st) => ({
      dailyPlans: st.dailyPlans.map((d) =>
        d.id === targetDay.id ? { ...d, lodging } : d,
      ),
    }))
    get().pushLog(`已将 AI 推荐住宿填入第 ${targetDay.dayIndex} 天：${lodging.name}`)
    get().scheduleAiRefresh()
  },

  fetchAmapPoi: async () => {
    const s = get()
    const cityName = s.amapCityName.trim()
    if (!cityName) {
      get().pushLog('请先选择城市再获取高德 POI 推荐。', 'error')
      return
    }
    const city = s.cities.find((c) => c.name === cityName)
    if (!city) {
      get().pushLog('未找到该城市对应数据。', 'error')
      return
    }
    const keywords = s.amapKeywords.trim() || '景点'
    get().pushLog(`正在请求高德 POI：${cityName} / ${keywords}...`)
    try {
      const url = `/api/amap/poi?city=${encodeURIComponent(cityName)}&keywords=${encodeURIComponent(keywords)}&quality=normal`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        get().pushLog(data.error || `请求失败 ${res.status}`, 'error')
        return
      }
      const pois = data.pois || []
      if (!pois.length) {
        get().pushLog('高德未返回结果，可换关键词或城市。', 'warn')
        return
      }
      let added = 0
      const spots = [...get().spots]
      for (const p of pois) {
        const loc = p.location ? String(p.location).split(',') : []
        const lng = parseFloat(loc[0])
        const lat = parseFloat(loc[1])
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue
        const name = (p.name || '').trim()
        if (!name) continue
        if (isDuplicateSpot(spots, city.id, name, lat, lng)) continue
        const address = (p.address || '').trim()
        const type = (p.type || '').trim()
        const rating = Number(p.biz_ext?.rating || p.rating || 0) || undefined
        const metaParts: string[] = []
        if (type) metaParts.push(type)
        if (address) metaParts.push(address)
        if (rating) metaParts.push(`评分约 ${rating}`)
        spots.push({
          id: uid('spot_amap'),
          cityId: city.id,
          name,
          location: { lat, lng },
          innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
        })
        added++
      }
      set({ spots })
      get().pushLog(`已将 ${added} 个高德 POI 加入景点池（${cityName}）。`)
      get().scheduleAiRefresh()
    } catch (e) {
      get().pushLog(`高德 POI 请求失败：${e instanceof Error ? e.message : e}`, 'error')
    }
  },

  fetchAmapPoiByAI: async () => {
    const s = get()
    const cityName = s.amapCityName.trim()
    if (!cityName) {
      get().pushLog('请先选择城市，再用 AI 帮忙找 POI。', 'error')
      return
    }
    const city = s.cities.find((c) => c.name === cityName)
    if (!city) {
      get().pushLog('未找到该城市对应数据。', 'error')
      return
    }
    const natural = s.amapNatural.trim()
    if (!natural) {
      get().pushLog('请先用自然语言描述你想找的地方，例如：适合亲子的安静公园。', 'error')
      return
    }
    const trip = collectTripContext(get)
    get().pushLog(`正在让 AI 帮你构建高德搜索条件：${natural}`)
    try {
      const res = await fetch('/api/ai/poi-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naturalQuery: natural, cityName, trip }),
      })
      const data = await res.json()
      if (!res.ok) {
        get().pushLog(data.error || `AI 解析失败 ${res.status}`, 'error')
        return
      }
      const keywords = (data.keywords || '').trim() || '景点'
      const types = (data.types || '').trim()
      const quality = data.quality === 'high' ? 'high' : 'normal'
      let url = `/api/amap/poi?city=${encodeURIComponent(cityName)}&keywords=${encodeURIComponent(keywords)}&quality=${encodeURIComponent(quality)}`
      if (types) url += `&types=${encodeURIComponent(types)}`
      const poiRes = await fetch(url)
      const poiData = await poiRes.json()
      if (!poiRes.ok) {
        get().pushLog(poiData.error || `请求失败 ${poiRes.status}`, 'error')
        return
      }
      const pois = poiData.pois || []
      if (!pois.length) {
        get().pushLog('高德未返回结果，可尝试调整描述。', 'warn')
        return
      }
      let added = 0
      const spots = [...get().spots]
      for (const p of pois) {
        const loc = p.location ? String(p.location).split(',') : []
        const lng = parseFloat(loc[0])
        const lat = parseFloat(loc[1])
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue
        const name = (p.name || '').trim()
        if (!name) continue
        if (isDuplicateSpot(spots, city.id, name, lat, lng)) continue
        const address = (p.address || '').trim()
        const type = (p.type || '').trim()
        const rating = Number(p.biz_ext?.rating || p.rating || 0) || undefined
        const metaParts: string[] = []
        if (type) metaParts.push(type)
        if (address) metaParts.push(address)
        if (rating) metaParts.push(`评分约 ${rating}`)
        spots.push({
          id: uid('spot_amap_ai'),
          cityId: city.id,
          name,
          location: { lat, lng },
          innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
        })
        added++
      }
      set({ spots })
      get().pushLog(`已根据 AI+高德为 ${cityName} 加入 ${added} 个候选景点到景点池。`)
      get().scheduleAiRefresh()
    } catch (e) {
      get().pushLog(`AI 辅助高德 POI 请求失败：${e instanceof Error ? e.message : e}`, 'error')
    }
  },

  autoSeedPoisForCity: async (city) => {
    const cityName = city.name
    get().pushLog(`正在为新城市「${cityName}」自动获取一批高德推荐景点候选...`)
    try {
      const url = `/api/amap/poi?city=${encodeURIComponent(cityName)}&keywords=${encodeURIComponent('景点')}&types=110000&quality=high`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        get().pushLog(data.error || `请求失败 ${res.status}`, 'warn')
        return
      }
      const pois = data.pois || []
      if (!pois.length) {
        get().pushLog('自动获取高德景点失败：未返回任何结果。', 'warn')
        return
      }
      const top = pois.slice(0, 6)
      const names = top.map((p: { name?: string }) => p.name).filter(Boolean).join(' / ')
      const shouldAdd = window.confirm(
        `为城市「${cityName}」找到了 ${top.length} 个高德推荐景点：\n\n${names}\n\n是否将它们加入景点池（之后可在景点池中删除不需要的）？`,
      )
      if (!shouldAdd) {
        get().pushLog('已取消自动加入高德景点，你可以稍后在景点池中手动获取。')
        return
      }
      let added = 0
      const spots = [...get().spots]
      for (const p of top) {
        const loc = p.location ? String(p.location).split(',') : []
        const lng = parseFloat(loc[0])
        const lat = parseFloat(loc[1])
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue
        const name = (p.name || '').trim()
        if (!name) continue
        if (isDuplicateSpot(spots, city.id, name, lat, lng)) continue
        const address = (p.address || '').trim()
        const type = (p.type || '').trim()
        const rating = Number(p.biz_ext?.rating || p.rating || 0) || undefined
        const metaParts: string[] = []
        if (type) metaParts.push(type)
        if (address) metaParts.push(address)
        if (rating) metaParts.push(`评分约 ${rating}`)
        spots.push({
          id: uid('spot_amap_seed'),
          cityId: city.id,
          name,
          location: { lat, lng },
          innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
        })
        added++
      }
      set({ spots })
      get().pushLog(
        added
          ? `已为城市「${cityName}」自动加入 ${added} 个来自高德的候选景点，可在景点池中进一步筛选。`
          : '自动加入高德景点时未发现新的候选点（可能都已存在）。',
      )
      get().scheduleAiRefresh()
    } catch (e) {
      get().pushLog(`为城市自动获取高德景点失败：${e instanceof Error ? e.message : e}`, 'error')
    }
  },

  extendDaySpotsByAI: async (dayId) => {
    const s = get()
    const day = s.dailyPlans.find((d) => d.id === dayId)
    if (!day) {
      get().pushLog('未找到该天的行程数据，无法为其推荐景点。', 'error')
      return
    }
    const city = s.cities.find((c) => c.id === day.cityId)
    if (!city) {
      get().pushLog('未找到该天所在城市，无法为其推荐景点。', 'error')
      return
    }
    const budgetPerDay = parseFloat(s.aiBudget) || 0
    const base = buildAiPrompt({
      trip: collectTripContext(get),
      focusCityId: city.id,
      budgetPerDay,
      focus: 'all',
    })
    const extra = `\n\n【额外要求】\n仅针对上述行程中的第 ${day.dayIndex} 天（城市：${city.name}），在 sections 中增加或补充分 type="spots" 的推荐，用于「补充 1-3 个新的景点候选」，优先考虑与当日已有景点动线相近的小众或特色景点。\n不要修改用户已存在的行程，只做补充建议。`
    const prompt = base + extra
    get().pushLog(`正在为第 ${day.dayIndex} 天（${city.name}）请求 AI 补充景点候选...`)
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) {
        get().pushLog(data.error || `请求失败 ${res.status}`, 'error')
        return
      }
      const sections = Array.isArray(data.sections) ? data.sections : []
      const spotSections = sections.filter((sec: AiSection) => sec.type === 'spots')
      if (!spotSections.length) {
        get().pushLog('AI 未返回可用的补充景点候选。', 'warn')
        return
      }
      set({ aiCityId: city.id })
      let added = 0
      const spots = [...get().spots]
      const dailyPlans = [...get().dailyPlans]
      const d = dailyPlans.find((x) => x.id === dayId)
      if (!d) return
      for (const sec of spotSections) {
        for (const item of sec.items || []) {
          const name = (item.title || '').trim()
          if (!name) continue
          const lat = typeof item.lat === 'number' ? item.lat : city.location?.lat
          const lng = typeof item.lng === 'number' ? item.lng : city.location?.lng
          if (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            isDuplicateSpot(spots, city.id, name, lat, lng)
          ) {
            continue
          }
          const id = uid('spot_ai_day')
          spots.push({
            id,
            cityId: city.id,
            name,
            location: { lat: typeof lat === 'number' ? lat : 0, lng: typeof lng === 'number' ? lng : 0 },
            guideUrl: item.guideUrl,
            visitTimeText: item.summary,
            innerTransport: item.innerTransport,
          })
          d.spotOrder.push(id)
          added++
        }
      }
      if (!added) {
        get().pushLog('AI 补充景点与现有景点高度重复，未添加新的候选。', 'warn')
        return
      }
      set({ spots, dailyPlans })
      get().pushLog(
        `已为第 ${day.dayIndex} 天（${city.name}）加入 ${added} 个 AI 补充景点，并自动添加到当天顺序末尾。`,
      )
      get().scheduleAiRefresh()
    } catch (e) {
      get().pushLog(`为当天补充 AI 景点失败：${e instanceof Error ? e.message : e}`, 'error')
    }
  },

  runReasonablenessChecks: () => {
    const { dailyPlans } = get()
    if (!dailyPlans.length) {
      get().pushLog('尚未创建任何每日行程，无法检查。', 'warn')
      return
    }
    const daysWithoutLodging = dailyPlans
      .filter((d) => !d.lodging?.name)
      .map((d) => d.dayIndex)
    if (daysWithoutLodging.length) {
      get().pushLog(
        `以下天数未填写住宿信息：第 ${daysWithoutLodging.join('、')} 天。虽然前端不强制必填，但建议补充以确保每晚都有住宿安排。`,
        'warn',
      )
    } else {
      get().pushLog('所有天数都填写了住宿信息 ✔')
    }
    dailyPlans.forEach((day) => {
      if (day.spotOrder.length > 6) {
        get().pushLog(
          `第 ${day.dayIndex} 天安排了 ${day.spotOrder.length} 个景点，可能过于紧凑，可适当删减或拆分到其他天。`,
          'warn',
        )
      } else if (day.spotOrder.length <= 1) {
        get().pushLog(
          `第 ${day.dayIndex} 天只安排了 ${day.spotOrder.length} 个景点，行程较宽松，可适当增加景点或休息时间。`,
        )
      }
    })
  },

  resetQuiz: () =>
    set({
      tripQuizPath: ['q_length'],
      tripQuizTags: [],
      quizNodeId: 'q_length',
      quizPhase: 'question',
    }),

  setQuizNode: (id) => {
    set((s) => {
      let path = [...s.tripQuizPath]
      if (!path.length) path = [id]
      else if (path[path.length - 1] !== id) path = [...path, id]
      return { quizNodeId: id, tripQuizPath: path }
    })
  },

  selectQuizOption: (tags, nextId) => {
    set((s) => ({ tripQuizTags: [...s.tripQuizTags, ...tags] }))
    if (nextId) {
      get().setQuizNode(nextId)
    } else {
      set({ quizPhase: 'result' })
    }
  },

  quizGoPrev: () => {
    const s = get()
    if (s.tripQuizPath.length <= 1) return
    const path = s.tripQuizPath.slice(0, -1)
    const prevId = path[path.length - 1]
    set({ tripQuizPath: path, quizNodeId: prevId, quizPhase: 'question' })
  },

  quizBackFromResult: () => {
    set((s) => ({
      tripQuizTags: s.tripQuizTags.slice(0, -1),
      quizNodeId: 'q_food',
      quizPhase: 'question',
    }))
  },

  appendExpectationFromQuiz: () => {
    const tags = get().tripQuizTags
    const profile = buildTripProfileFromTags(tags)
    if (!profile) {
      get().pushLog('请先完成几道题，让我们了解你的旅行偏好。', 'error')
      return
    }
    const marker = '【旅行性格测验画像】'
    const block = `${marker}${profile.summary}`
    set((s) => ({
      tripExpectation: s.tripExpectation.trim()
        ? `${s.tripExpectation.trim()}\n\n${block}`
        : block,
      tripWizardOpen: false,
    }))
    get().pushLog(
      '已根据测验结果生成旅行画像，并写入「旅行期望」，之后的 AI 推荐会参考这些偏好。',
    )
  },
}))
