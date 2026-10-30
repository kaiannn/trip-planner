import type { Spot } from '../../types'
import { buildAiPrompt } from '../../lib/aiPrompt'
import { isDuplicateSpot } from '../../lib/geo'
import {
  fetchAiRecommend,
  streamAiRecommend,
  fetchAiPoiCoarseFilter,
  abortPendingAiRequest,
} from '../../api/ai'
import { fetchAmapPoiAround, type AmapPoi } from '../../api/amap'
import { useLogStore } from '../logStore'
import { useSettingsStore } from '../settingsStore'
import type { AiFocus, AiItem, AiSection } from '../../types'
import type { SetFn, GetFn } from '../types'
import { uid, collectTripContext, convertAmapPois } from '../utils'
import {
  buildTaskBrief,
  missingSlots,
  PACE_LABELS,
  type MissingSlot,
  type TaskBrief,
  type TaskPace,
} from '../../lib/taskBrief'
import {
  amapTypesForInterests,
  type CoarseFilterPoi,
} from '../../lib/poiCoarseFilter'
import { effectiveVisitMinutes } from '../../lib/visitTime'

/** Nearby places for hotel-centered "附近可逛" (L1). Not persisted. */
export interface HotelAroundState {
  hotelAroundHotelId: string | null
  hotelAroundStatus: string
  hotelAroundPois: AmapPoi[]
  /** LLM keep order; null = filter skipped / fallback rank. */
  hotelAroundKeepIds: string[] | null
  hotelAroundSelected: string[]
}

export interface AiState extends HotelAroundState {
  aiCityId: string
  aiBudget: string
  aiStatus: string
  aiPromptText: string
  aiSections: AiSection[]
  aiRefreshTimer: ReturnType<typeof setTimeout> | null
  /**
   * Trip changed since the last AI recommend. Edits only mark dirty;
   * a real LLM call runs on explicit refresh from AiCard.
   */
  aiDirty: boolean
  /** Structured pace override; '' = unset (missing slot). */
  taskPace: string
  /** Selected interest tags for the task brief. */
  taskInterests: string[]
  /** Explicit day count when dates/daily plans are absent. */
  taskDays: number | null
}

export interface AiActions {
  setAiCityId: (id: string) => void
  setAiBudget: (v: string) => void
  requestAiRecommendations: (focus?: AiFocus) => Promise<void>
  /** Mark recommendations stale without calling the LLM. */
  scheduleAiRefresh: () => void
  /** Run reasonableness checks only — no LLM. */
  refreshTripChecks: () => void
  setTaskPace: (pace: TaskPace | '') => void
  toggleTaskInterest: (interest: string) => void
  setTaskDays: (days: number | null) => void
  getTaskBrief: () => TaskBrief
  getMissingSlots: () => MissingSlot[]
  applyAiSpotItem: (item: AiItem) => void
  applyAiLodgingItem: (item: AiItem) => void
  extendDaySpotsByAI: (dayId: string) => Promise<void>
  runReasonablenessChecks: () => void
  /** Hotel-centered around recall + coarse filter. */
  fetchHotelAround: (hotelId: string) => Promise<void>
  toggleHotelAroundSelected: (poiId: string) => void
  setHotelAroundSelectedAll: (ids: string[]) => void
  addSelectedHotelAround: () => number
  clearHotelAround: () => void
}

export const initialAiState: AiState = {
  aiCityId: '',
  aiBudget: '',
  aiStatus: '未请求',
  aiPromptText: '',
  aiSections: [],
  aiRefreshTimer: null,
  aiDirty: false,
  taskPace: '',
  taskInterests: [],
  taskDays: null,
  hotelAroundHotelId: null,
  hotelAroundStatus: '',
  hotelAroundPois: [],
  hotelAroundKeepIds: null,
  hotelAroundSelected: [],
}

export function createAiActions(set: SetFn, get: GetFn): AiActions {
  const collectBriefSource = () => {
    const s = get()
    return {
      cityNames: s.cities.slice().sort((a, b) => a.order - b.order).map((c) => c.name),
      tripStart: s.tripStart,
      tripEnd: s.tripEnd,
      dailyPlanCount: s.dailyPlans.length,
      aiBudget: s.aiBudget,
      taskPace: s.taskPace,
      taskInterests: s.taskInterests,
      taskDays: s.taskDays,
    }
  }

  return {
    setAiCityId: (id) => set({ aiCityId: id }),
    setAiBudget: (v) => set({ aiBudget: v, aiDirty: true }),
    setTaskPace: (pace) => set({ taskPace: pace, aiDirty: true }),
    toggleTaskInterest: (interest) =>
      set((st) => ({
        taskInterests: st.taskInterests.includes(interest)
          ? st.taskInterests.filter((x) => x !== interest)
          : [...st.taskInterests, interest],
        aiDirty: true,
      })),
    setTaskDays: (days) => set({ taskDays: days, aiDirty: true }),
    getTaskBrief: () => buildTaskBrief(collectBriefSource()),
    getMissingSlots: () => missingSlots(buildTaskBrief(collectBriefSource())),

    requestAiRecommendations: async (focus: AiFocus = 'all') => {
      const s = get()
      const focusCityId = s.aiCityId || s.cities[0]?.id || ''
      const budgetPerDay = parseFloat(s.aiBudget) || 0
      const trip = collectTripContext(get)
      const brief = buildTaskBrief(collectBriefSource())
      const prompt = buildAiPrompt({ trip, focusCityId, budgetPerDay, focus, brief })
      set({
        aiStatus: '正在向后端请求 AI 推荐…',
        aiPromptText: prompt,
        aiSections: [],
        aiDirty: false,
        aiRefreshTimer: null,
      })
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

    refreshTripChecks: () => {
      get().bumpMapRedraw()
      get().runReasonablenessChecks()
    },

    scheduleAiRefresh: () => {
      // Cost control: trip edits only mark recommendations stale.
      // A full LLM regenerate runs when the user hits refresh on AiCard.
      const t = get().aiRefreshTimer
      if (t) clearTimeout(t)
      abortPendingAiRequest()
      const hadSections = get().aiSections.length > 0
      set({
        aiDirty: true,
        aiRefreshTimer: null,
        aiStatus: hadSections
          ? '行程有改动，推荐待刷新（不会自动请求 AI）。当前展示的是上一次结果。'
          : '行程有改动，推荐待刷新（不会自动请求 AI）。',
      })
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
      const base = buildAiPrompt({
        trip: collectTripContext(get),
        focusCityId: city.id,
        budgetPerDay,
        focus: 'all',
        brief: buildTaskBrief(collectBriefSource()),
      })
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
      const { dailyPlans, spots } = get()
      if (!dailyPlans.length) { useLogStore.getState().pushLog('尚未创建任何每日行程。', 'warn'); return }
      const daysWithoutLodging = dailyPlans.filter((d) => !d.lodging?.name).map((d) => d.dayIndex)
      if (daysWithoutLodging.length) {
        useLogStore.getState().pushLog(`以下天数未填写住宿：第 ${daysWithoutLodging.join('、')} 天。`, 'warn')
      } else {
        useLogStore.getState().pushLog('所有天数都填写了住宿信息 ✔')
      }
      const byId = new Map(spots.map((sp) => [sp.id, sp]))
      dailyPlans.forEach((day) => {
        if (day.spotOrder.length > 6) {
          useLogStore.getState().pushLog(`第 ${day.dayIndex} 天安排了 ${day.spotOrder.length} 个景点，可能过于紧凑。`, 'warn')
        } else if (day.spotOrder.length <= 1) {
          useLogStore.getState().pushLog(`第 ${day.dayIndex} 天只安排了 ${day.spotOrder.length} 个景点，行程较宽松。`)
        }
        let load = 0
        let known = 0
        for (let i = 0; i < day.spotOrder.length; i++) {
          const sp = byId.get(day.spotOrder[i])
          if (!sp) continue
          known++
          load += effectiveVisitMinutes(sp)
          const prev = i > 0 ? byId.get(day.spotOrder[i - 1]) : null
          if (prev?.location && sp.location) {
            const dx = Math.abs(sp.location.lng - prev.location.lng)
            const dy = Math.abs(sp.location.lat - prev.location.lat)
            const deg = Math.max(dx, dy)
            load += Math.round(deg * 1500)
          }
        }
        if (known >= 2 && load > 480) {
          useLogStore.getState().pushLog(
            `第 ${day.dayIndex} 天预计约 ${Math.round(load / 60)} 小时行程，建议减 1 站或改节奏。`,
            'warn',
          )
        }
      })
    },

    fetchHotelAround: async (hotelId) => {
      get().markUserTrip()
      const hotel = get().spots.find((s) => s.id === hotelId)
      if (!hotel || hotel.kind !== 'hotel') {
        set({ hotelAroundStatus: '未找到酒店。' })
        return
      }
      if (!hotel.location || typeof hotel.location.lat !== 'number') {
        set({ hotelAroundStatus: '该酒店没有坐标，请先在地图上定位。' })
        return
      }

      const brief = buildTaskBrief(collectBriefSource())
      const types =
        brief.interestFocus.length > 0
          ? amapTypesForInterests(brief.interestFocus)
          : // default nearby mix: sights + food + shopping (not hotels)
            '110000|050000|060000'

      set({
        hotelAroundHotelId: hotelId,
        hotelAroundStatus: `正在检索「${hotel.name}」附近 2km…`,
        hotelAroundPois: [],
        hotelAroundKeepIds: null,
        hotelAroundSelected: [],
      })

      let around: AmapPoi[] = []
      try {
        around = await fetchAmapPoiAround({
          location: `${hotel.location.lng},${hotel.location.lat}`,
          radius: 2000,
          types,
          pageSize: 25,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        set({ hotelAroundStatus: `附近检索失败：${msg}` })
        return
      }

      // Drop nested hotels; keep walkable food/sights/shopping.
      const uniq: AmapPoi[] = []
      const seen = new Set<string>()
      for (const p of around) {
        const key = p.id || p.name?.trim() || ''
        if (!key || seen.has(key)) continue
        if (p.type?.includes('100000')) continue
        seen.add(key)
        uniq.push(p)
      }
      if (!uniq.length) {
        set({ hotelAroundStatus: '附近 2km 未找到可逛地点。' })
        return
      }

      const filterPois: CoarseFilterPoi[] = uniq
        .map((p) => {
          const rating = Number(p.biz_ext?.rating || p.rating || 0)
          return {
            id: p.id || p.name || '',
            name: (p.name || '').trim(),
            type: p.type,
            rating: rating || undefined,
            cost: p.cost,
          }
        })
        .filter((p) => p.id && p.name)

      set({ hotelAroundStatus: `召回 ${filterPois.length} 个，正在按简报粗筛…` })
      let keepIds: string[]
      try {
        keepIds = await fetchAiPoiCoarseFilter(
          filterPois,
          {
            description: `酒店「${hotel.name}」附近可散步/用餐/轻游览的地点`,
            interests: brief.interestFocus,
            pace: brief.pace ? PACE_LABELS[brief.pace] : undefined,
            budgetPerDay: brief.budgetPerDay,
          },
          { maxKeep: 12 },
        )
        set({ hotelAroundKeepIds: keepIds })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        useLogStore.getState().pushLog(
          `周边粗筛失败（${msg}），按召回顺序展示前 12 个。`,
          'warn',
        )
        if (msg.includes('LLM API Key')) useSettingsStore.getState().setSettingsOpen(true)
        keepIds = filterPois.slice(0, 12).map((p) => p.id)
        set({ hotelAroundKeepIds: null })
      }

      if (!keepIds.length) {
        set({ hotelAroundStatus: '粗筛未保留任何地点。' })
        return
      }

      const ordered = keepIds
        .map((id) => uniq.find((p) => (p.id || p.name) === id))
        .filter((p): p is AmapPoi => Boolean(p))

      set({
        hotelAroundPois: ordered,
        hotelAroundSelected: ordered.slice(0, 5).map((p) => p.id || p.name || ''),
        hotelAroundStatus: `附近可逛：保留 ${ordered.length} / 召回 ${uniq.length}（已勾选前 5）`,
      })
    },

    toggleHotelAroundSelected: (poiId) =>
      set((st) => ({
        hotelAroundSelected: st.hotelAroundSelected.includes(poiId)
          ? st.hotelAroundSelected.filter((x) => x !== poiId)
          : [...st.hotelAroundSelected, poiId],
      })),

    setHotelAroundSelectedAll: (ids) => set({ hotelAroundSelected: ids }),

    addSelectedHotelAround: () => {
      const s = get()
      const hotelId = s.hotelAroundHotelId
      const hotel = hotelId ? s.spots.find((sp) => sp.id === hotelId) : null
      if (!hotel) {
        useLogStore.getState().pushLog('请先对某家酒店执行「附近可逛」。', 'warn')
        return 0
      }
      const selected = new Set(s.hotelAroundSelected)
      if (!selected.size) {
        useLogStore.getState().pushLog('请先勾选要加入景点池的地点。', 'warn')
        return 0
      }
      const orderedIds = s.hotelAroundPois
        .map((p) => p.id || p.name || '')
        .filter((id) => selected.has(id))
      const picked = orderedIds
        .map((id) => s.hotelAroundPois.find((p) => (p.id || p.name) === id))
        .filter((p): p is AmapPoi => Boolean(p))
        .slice(0, 20)

      const result = convertAmapPois(picked, hotel.cityId, s.spots, 'spot_hotel_around')
      // kind: food vs sight from AMap type
      const kindById = new Map<string, Spot['kind']>()
      for (const p of picked) {
        const id = p.id || p.name || ''
        kindById.set(id, kindFromAmapType(p.type))
      }
      const spots = result.spots.map((sp) => {
        const kind = sp.amapId ? kindById.get(sp.amapId) : undefined
        if (!kind || kind === sp.kind) return sp
        return { ...sp, kind } as Spot
      })
      const added = spots.length - s.spots.length
      set({ spots })
      if (added) {
        useLogStore.getState().pushLog(
          `已从「${hotel.name}」附近加入 ${added} 个地点到景点池。`,
        )
        get().scheduleAiRefresh()
      } else {
        useLogStore.getState().pushLog('所选地点都已在景点池中。')
      }
      return added
    },

    clearHotelAround: () =>
      set({
        hotelAroundHotelId: null,
        hotelAroundStatus: '',
        hotelAroundPois: [],
        hotelAroundKeepIds: null,
        hotelAroundSelected: [],
      }),
  }
}

/** AMap type (codes or Chinese labels) → Spot.kind for nearby adds. */
function kindFromAmapType(type?: string): Spot['kind'] {
  if (!type) return 'sight'
  if (type.includes('100000') || type.includes('酒店') || type.includes('住宿')) {
    return 'hotel'
  }
  if (type.includes('050000') || type.includes('餐饮') || type.includes('美食')) {
    return 'restaurant'
  }
  return 'sight'
}
