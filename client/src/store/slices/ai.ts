import type { Spot } from '../../types'
import { buildAiPrompt } from '../../lib/aiPrompt'
import { isDuplicateSpot } from '../../lib/geo'
import { fetchAiRecommend, streamAiRecommend, fetchAiSeedPool, abortPendingAiRequest } from '../../api/ai'
import { useLogStore } from '../logStore'
import { useSettingsStore } from '../settingsStore'
import type { AiFocus, AiItem, AiSection } from '../../types'
import type { SetFn, GetFn } from '../types'
import { uid, collectTripContext } from '../utils'

export interface AiState {
  aiCityId: string
  aiBudget: string
  aiStatus: string
  aiPromptText: string
  aiSections: AiSection[]
  aiRefreshTimer: ReturnType<typeof setTimeout> | null
  aiSeedInput: string
  aiSeedStatus: string
}

export interface AiActions {
  setAiCityId: (id: string) => void
  setAiBudget: (v: string) => void
  setAiSeedInput: (v: string) => void
  requestAiRecommendations: (focus?: AiFocus) => Promise<void>
  syncTripIntelligence: () => Promise<void>
  scheduleAiRefresh: () => void
  applyAiSpotItem: (item: AiItem) => void
  applyAiLodgingItem: (item: AiItem) => void
  extendDaySpotsByAI: (dayId: string) => Promise<void>
  runReasonablenessChecks: () => void
  seedPoolFromAi: () => Promise<void>
}

export const initialAiState: AiState = {
  aiCityId: '',
  aiBudget: '',
  aiStatus: '未请求',
  aiPromptText: '',
  aiSections: [],
  aiRefreshTimer: null,
  aiSeedInput: '',
  aiSeedStatus: '',
}

export function createAiActions(set: SetFn, get: GetFn): AiActions {
  return {
    setAiCityId: (id) => set({ aiCityId: id }),
    setAiBudget: (v) => set({ aiBudget: v }),
    setAiSeedInput: (v) => set({ aiSeedInput: v }),

    requestAiRecommendations: async (focus: AiFocus = 'all') => {
      const s = get()
      const focusCityId = s.aiCityId || s.cities[0]?.id || ''
      const budgetPerDay = parseFloat(s.aiBudget) || 0
      const trip = collectTripContext(get)
      const prompt = buildAiPrompt({ trip, focusCityId, budgetPerDay, focus })
      set({ aiStatus: '正在向后端请求 AI 推荐…', aiPromptText: prompt, aiSections: [] })
      try {
        const finalSections = await streamAiRecommend(prompt, {
          onSections: (sections) => {
            set({ aiSections: sections, aiStatus: `AI 正在生成…（已返回 ${sections.length} 条）` })
          },
          onProgress: (bytes) => {
            if (!get().aiSections.length) {
              set({ aiStatus: `AI 正在生成…（${bytes} 字）` })
            }
          },
          onRetry: ({ attempt, delayMs, error }) => {
            const msg = error instanceof Error ? error.message : String(error)
            set({ aiStatus: `第 ${attempt} 次失败:${msg.slice(0, 60)}…${(delayMs / 1000).toFixed(1)}s 后重试` })
            useLogStore.getState().pushLog(
              `AI 推荐第 ${attempt} 次失败:${msg}。${(delayMs / 1000).toFixed(1)} 秒后自动重试。`, 'warn',
            )
          },
        })
        set({
          aiSections: finalSections,
          aiStatus: finalSections.length ? '已根据当前行程生成 AI 推荐。' : 'AI 没有返回可用的推荐，请适当调整行程后重试。',
        })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          set({ aiStatus: '已取消上一次 AI 请求。' })
          return
        }
        const msg = e instanceof Error ? e.message : String(e)
        set({ aiStatus: `请求失败:${msg}` })
        useLogStore.getState().pushLog(`AI 推荐请求失败:${msg}`, 'error')
        if (msg.includes('LLM API Key')) useSettingsStore.getState().setSettingsOpen(true)
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
      abortPendingAiRequest()
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
        useLogStore.getState().pushLog('无法应用景点:当前没有可用城市。', 'error')
        return
      }
      const name = item.title || 'AI 推荐景点'
      if (typeof item.lat === 'number' && typeof item.lng === 'number') {
        s.addSpot({
          kind: 'sight', cityId: city.id, name,
          location: { lat: item.lat, lng: item.lng },
          guideUrl: item.guideUrl, visitTimeText: item.summary, innerTransport: item.innerTransport,
        } as Omit<Spot, 'id'>)
        useLogStore.getState().pushLog(`已将 AI 推荐景点加入:${name}`)
        return
      }
      const AMapNs = typeof window !== 'undefined' ? window.AMap : undefined
      if (!AMapNs?.Geocoder) {
        useLogStore.getState().pushLog(`无法添加「${name}」:AI 没给坐标,且地图还未加载,跳过。`, 'warn')
        return
      }
      try {
        const g = new AMapNs.Geocoder({ city: city.name })
        g.getLocation(`${city.name}${name}`, (status, result) => {
          if (status !== 'complete' || result.info !== 'OK' || !result.geocodes?.length) {
            useLogStore.getState().pushLog(`无法添加「${name}」:地理编码失败,已跳过。`, 'warn')
            return
          }
          const loc = result.geocodes[0].location
          s.addSpot({
            kind: 'sight', cityId: city.id, name,
            location: { lat: loc.lat, lng: loc.lng },
            guideUrl: item.guideUrl, visitTimeText: item.summary, innerTransport: item.innerTransport,
          } as Omit<Spot, 'id'>)
          useLogStore.getState().pushLog(`已将 AI 推荐景点加入:${name} (通过地理编码定位)`)
        })
      } catch {
        useLogStore.getState().pushLog(`无法添加「${name}」:地理编码抛出异常,跳过。`, 'warn')
      }
    },

    applyAiLodgingItem: (item) => {
      const s = get()
      const cityId = s.aiCityId || s.cities[0]?.id || ''
      const cityDays = s.dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex).filter((d) => d.cityId === cityId)
      const targetDay = cityDays.find((d) => !d.lodging?.name) || cityDays[0]
      if (!targetDay) {
        useLogStore.getState().pushLog('当前城市没有对应的每日行程，无法填入住宿。', 'warn')
        return
      }
      const lodging = { name: item.title || 'AI 推荐住宿', address: item.meta || item.detail || item.summary || '' }
      set((st) => ({
        dailyPlans: st.dailyPlans.map((d) => (d.id === targetDay.id ? { ...d, lodging } : d)),
      }))
      useLogStore.getState().pushLog(`已将 AI 推荐住宿填入第 ${targetDay.dayIndex} 天：${lodging.name}`)
      get().scheduleAiRefresh()
    },

    extendDaySpotsByAI: async (dayId) => {
      const s = get()
      const day = s.dailyPlans.find((d) => d.id === dayId)
      if (!day) { useLogStore.getState().pushLog('未找到该天的行程数据。', 'error'); return }
      const city = s.cities.find((c) => c.id === day.cityId)
      if (!city) { useLogStore.getState().pushLog('未找到该天所在城市。', 'error'); return }
      const budgetPerDay = parseFloat(s.aiBudget) || 0
      const base = buildAiPrompt({ trip: collectTripContext(get), focusCityId: city.id, budgetPerDay, focus: 'all' })
      const extra = `\n\n【额外要求】\n仅针对第 ${day.dayIndex} 天（${city.name}），补充 1-3 个新景点候选，优先与当日已有景点动线相近的小众景点。`
      useLogStore.getState().pushLog(`正在为第 ${day.dayIndex} 天（${city.name}）请求 AI 补充景点...`)
      try {
        const sections = await fetchAiRecommend(base + extra)
        const spotSections = sections.filter((sec: AiSection) => sec.type === 'spots')
        if (!spotSections.length) { useLogStore.getState().pushLog('AI 未返回补充景点。', 'warn'); return }
        set({ aiCityId: city.id })
        let added = 0
        const spots = [...s.spots]
        const dailyPlans = [...s.dailyPlans]
        const d = dailyPlans.find((x) => x.id === dayId)
        if (!d) return
        for (const sec of spotSections) {
          for (const item of sec.items || []) {
            const name = (item.title || '').trim()
            if (!name) continue
            const lat = typeof item.lat === 'number' ? item.lat : city.location?.lat
            const lng = typeof item.lng === 'number' ? item.lng : city.location?.lng
            if (typeof lat === 'number' && typeof lng === 'number' && isDuplicateSpot(spots, city.id, name, lat, lng)) continue
            const id = uid('spot_ai_day')
            spots.push({
              kind: 'sight', id, cityId: city.id, name,
              location: { lat: typeof lat === 'number' ? lat : 0, lng: typeof lng === 'number' ? lng : 0 },
              guideUrl: item.guideUrl, visitTimeText: item.summary, innerTransport: item.innerTransport,
            })
            d.spotOrder.push(id)
            added++
          }
        }
        if (!added) { useLogStore.getState().pushLog('AI 补充景点与现有景点高度重复。', 'warn'); return }
        set({ spots, dailyPlans } as Partial<AiState>)
        useLogStore.getState().pushLog(`已为第 ${day.dayIndex} 天加入 ${added} 个 AI 补充景点。`)
        get().scheduleAiRefresh()
      } catch (e) {
        useLogStore.getState().pushLog(`补充 AI 景点失败：${e instanceof Error ? e.message : e}`, 'error')
      }
    },

    runReasonablenessChecks: () => {
      const { dailyPlans } = get()
      if (!dailyPlans.length) { useLogStore.getState().pushLog('尚未创建任何每日行程。', 'warn'); return }
      const daysWithoutLodging = dailyPlans.filter((d) => !d.lodging?.name).map((d) => d.dayIndex)
      if (daysWithoutLodging.length) {
        useLogStore.getState().pushLog(`以下天数未填写住宿：第 ${daysWithoutLodging.join('、')} 天。`, 'warn')
      } else {
        useLogStore.getState().pushLog('所有天数都填写了住宿信息 ✔')
      }
      dailyPlans.forEach((day) => {
        if (day.spotOrder.length > 6) {
          useLogStore.getState().pushLog(`第 ${day.dayIndex} 天安排了 ${day.spotOrder.length} 个景点，可能过于紧凑。`, 'warn')
        } else if (day.spotOrder.length <= 1) {
          useLogStore.getState().pushLog(`第 ${day.dayIndex} 天只安排了 ${day.spotOrder.length} 个景点，行程较宽松。`)
        }
      })
    },

    seedPoolFromAi: async () => {
      const s = get()
      const desc = s.aiSeedInput.trim()
      if (!desc) { useLogStore.getState().pushLog('请先填写你想去哪。', 'warn'); return }
      const cityList = s.cities.slice().sort((a, b) => a.order - b.order)
      if (!cityList.length) { useLogStore.getState().pushLog('请至少添加一个城市。', 'warn'); return }
      set({ aiSeedStatus: 'AI 正在根据你的描述生成候选…' })
      let candidates
      try {
        candidates = await fetchAiSeedPool(desc, cityList.map((c) => ({ name: c.name })))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        set({ aiSeedStatus: `生成失败：${msg}` })
        useLogStore.getState().pushLog(`AI 填充景点池失败：${msg}`, 'error')
        if (msg.includes('LLM API Key')) useSettingsStore.getState().setSettingsOpen(true)
        return
      }
      if (!candidates.length) { set({ aiSeedStatus: 'AI 没有返回候选。' }); return }
      set({ aiSeedStatus: `收到 ${candidates.length} 个候选，正在定位坐标…` })
      const AMapNs = typeof window !== 'undefined' ? window.AMap : undefined
      const resolveOne = (name: string, city: string): Promise<{ lat: number; lng: number } | null> =>
        new Promise((resolve) => {
          if (!AMapNs?.Geocoder) return resolve(null)
          const g = new AMapNs.Geocoder({ city: city || '全国' })
          g.getLocation(city ? `${city}${name}` : name, (status, result) => {
            if (status === 'complete' && result.info === 'OK' && result.geocodes?.length) {
              resolve({ lat: result.geocodes[0].location.lat, lng: result.geocodes[0].location.lng })
            } else { resolve(null) }
          })
        })
      let added = 0
      let skipped = 0
      const skippedNames: string[] = []
      for (const c of candidates) {
        const matched = cityList.find((city) => c.cityHint ? city.name.includes(c.cityHint) : false) ?? cityList[0]
        let loc = typeof c.lat === 'number' && typeof c.lng === 'number' ? { lat: c.lat, lng: c.lng } : null
        if (!loc) loc = await resolveOne(c.name, matched.name)
        if (!loc) { skipped++; skippedNames.push(c.name); continue }
        if (s.addSpot({ kind: c.kind ?? 'sight', cityId: matched.id, name: c.name, location: loc, description: c.description, ...(c.kind === 'hotel' && c.price ? { price: c.price } : {}), ...(c.kind === 'restaurant' && c.link ? { link: c.link } : {}) } as Omit<Spot, 'id'>)) added++
      }
      set({ aiSeedStatus: `已添加 ${added} 个景点${skipped ? `，${skipped} 个因无法定位被跳过` : ''}。` })
      useLogStore.getState().pushLog(`AI 景点池填充完成:+${added} 个${skipped ? `(跳过 ${skipped} 个)` : ''}。`)
      if (skippedNames.length) {
        useLogStore.getState().pushLog(`以下景点因高德无法定位被跳过：${skippedNames.join('、')}`, 'warn')
      }
      try { await get().syncTripIntelligence() } catch (e) {
        useLogStore.getState().pushLog(`AI 建议生成失败:${e instanceof Error ? e.message : e}`, 'warn')
      }
    },
  }
}
