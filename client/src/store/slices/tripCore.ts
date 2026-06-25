import type { City, DailyPlan, Spot, TransportMode } from '../../types'
import type { AmapPoi } from '../../api/amap'
import { isDuplicateSpot } from '../../lib/geo'
import { deleteImageBlob } from '../../lib/imageStorage'
import { useLogStore } from '../logStore'
import {
  DEMO_CITIES,
  DEMO_DAILY_PLANS,
  DEMO_SPOTS,
  DEMO_TRIP_META,
} from '../../lib/demoData'
import type { SetFn, GetFn } from '../types'
import { uid, convertAmapPois } from '../utils'

export interface TripCoreState {
  cities: City[]
  spots: Spot[]
  dailyPlans: DailyPlan[]
  tripTitle: string
  tripStart: string
  tripEnd: string
  tripExpectation: string
  tripType: string
  appMode: 'collect' | 'arrange'
  autoSeedPending: { city: City; pois: AmapPoi[] } | null
}

export interface TripCoreActions {
  setTripField: (
    field: keyof Pick<TripCoreState, 'tripTitle' | 'tripStart' | 'tripEnd' | 'tripExpectation' | 'tripType'>,
    value: string,
  ) => void
  setAppMode: (v: 'collect' | 'arrange') => void
  addCity: (name: string, lat?: number, lng?: number) => City
  updateCityLocation: (cityId: string, lat: number, lng: number) => void
  moveCity: (cityId: string, delta: number) => void
  deleteCity: (cityId: string) => void
  addSpot: (spot: Omit<Spot, 'id'>) => boolean
  updateSpot: (spotId: string, patch: Partial<Omit<Spot, 'id'>>) => void
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
  reorderDays: (activeDayId: string, overDayId: string) => void
  setSegmentMode: (dayId: string, fromSpotId: string, toSpotId: string, mode: TransportMode) => void
  assignSpotToDay: (spotId: string, dayId: string) => void
  removeSpotFromDay: (spotId: string, dayId: string) => void
  moveSpotBetweenDays: (spotId: string, fromDayId: string, toDayId: string) => void
  ensureDaysForDateRange: () => number
  confirmAutoSeed: () => void
  cancelAutoSeed: () => void
  loadDemoData: () => void
}

export const initialTripCoreState: TripCoreState = {
  cities: [],
  spots: [],
  dailyPlans: [],
  tripTitle: '',
  tripStart: '',
  tripEnd: '',
  tripExpectation: '',
  tripType: '',
  appMode: 'collect',
  autoSeedPending: null,
}

export function createTripCoreActions(set: SetFn, get: GetFn): TripCoreActions {
  return {
    setTripField: (field, value) => set({ [field]: value } as Partial<TripCoreState>),
    setAppMode: (v) => set({ appMode: v }),

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
      useLogStore.getState().pushLog(`已添加城市：${city.name}`)
      return city
    },

    updateCityLocation: (cityId, lat, lng) => {
      const city = get().cities.find((c) => c.id === cityId)
      set((s) => ({
        cities: s.cities.map((c) =>
          c.id === cityId ? { ...c, location: { lat, lng } } : c,
        ),
      }))
      if (city) {
        void get().autoSeedPoisForCity({ ...city, location: { lat, lng } })
      }
    },

    moveCity: (cityId, delta) => {
      const cities = [...get().cities]
      const index = cities.findIndex((c) => c.id === cityId)
      if (index === -1) return
      const newIndex = index + delta
      if (newIndex < 0 || newIndex >= cities.length) return
      ;[cities[index], cities[newIndex]] = [cities[newIndex], cities[index]]
      cities.forEach((c, i) => { c.order = i })
      set({ cities })
      get().scheduleAiRefresh()
    },

    deleteCity: (cityId) => {
      set((s) => ({
        cities: s.cities.filter((c) => c.id !== cityId),
        spots: s.spots.filter((sp) => sp.cityId !== cityId),
        dailyPlans: s.dailyPlans.filter((d) => d.cityId !== cityId),
      }))
      useLogStore.getState().pushLog('已删除城市及其关联的景点和行程', 'warn')
      get().scheduleAiRefresh()
    },

    addSpot: (spotData) => {
      const { spots } = get()
      if (isDuplicateSpot(spots, spotData.cityId, spotData.name, spotData.location.lat, spotData.location.lng)) {
        useLogStore.getState().pushLog('该景点在当前城市中已经存在或位置非常接近，已自动跳过重复添加。', 'warn')
        return false
      }
      const spot: Spot = { ...spotData, id: uid('spot') }
      set((s) => ({ spots: [...s.spots, spot] }))
      useLogStore.getState().pushLog(`已添加景点：${spot.name}`)
      get().scheduleAiRefresh()
      return true
    },

    removeSpot: (spotId) => {
      const target = get().spots.find((x) => x.id === spotId)
      if (target?.imageBlobId) {
        void deleteImageBlob(target.imageBlobId).catch(() => {})
      }
      set((s) => ({
        spots: s.spots.filter((x) => x.id !== spotId),
        dailyPlans: s.dailyPlans.map((d) => ({
          ...d,
          spotOrder: d.spotOrder.filter((sid) => sid !== spotId),
        })),
      }))
      get().invalidateTrip()
    },

    updateSpot: (spotId, patch) => {
      set((s) => ({
        spots: s.spots.map((x) => (x.id === spotId ? { ...x, ...patch } : x)),
      }))
      get().invalidateTrip()
    },

    saveDay: ({ dayIndex, cityId, date, lodging, spotOrder, transportMode }) => {
      const plans = [...get().dailyPlans]
      const existingIndex = plans.findIndex((d) => d.dayIndex === dayIndex)
      if (existingIndex >= 0) {
        plans[existingIndex] = { ...plans[existingIndex], cityId, date, lodging, spotOrder, transportMode }
        useLogStore.getState().pushLog(`已更新第 ${dayIndex} 天行程`)
      } else {
        plans.push({ id: uid('day'), dayIndex, cityId, date, lodging, spotOrder, transportMode })
        useLogStore.getState().pushLog(`已保存第 ${dayIndex} 天行程`)
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
        dailyPlans: s.dailyPlans.map((d) => (d.id === dayId ? { ...d, spotOrder } : d)),
      }))
      get().scheduleAiRefresh()
    },

    reorderDays: (activeDayId, overDayId) => {
      if (activeDayId === overDayId) return
      set((s) => {
        const active = s.dailyPlans.find((d) => d.id === activeDayId)
        const over = s.dailyPlans.find((d) => d.id === overDayId)
        if (!active || !over) return s
        return {
          dailyPlans: s.dailyPlans.map((d) => {
            if (d.id === activeDayId) return { ...d, dayIndex: over.dayIndex }
            if (d.id === overDayId) return { ...d, dayIndex: active.dayIndex }
            return d
          }),
        }
      })
      get().bumpMapRedraw()
    },

    setSegmentMode: (dayId, fromSpotId, toSpotId, mode) => {
      const key = `${fromSpotId}|${toSpotId}`
      set((s) => ({
        dailyPlans: s.dailyPlans.map((d) => {
          if (d.id !== dayId) return d
          const next = { ...(d.segmentModes ?? {}) }
          if (mode === 'driving') { delete next[key] } else { next[key] = mode }
          return { ...d, segmentModes: next }
        }),
      }))
      get().bumpMapRedraw()
    },

    assignSpotToDay: (spotId, dayId) => {
      set((s) => ({
        dailyPlans: s.dailyPlans.map((d) => {
          if (d.id !== dayId) {
            return d.spotOrder.includes(spotId)
              ? { ...d, spotOrder: d.spotOrder.filter((id) => id !== spotId) }
              : d
          }
          if (d.spotOrder.includes(spotId)) return d
          return { ...d, spotOrder: [...d.spotOrder, spotId] }
        }),
      }))
      get().invalidateTrip()
    },

    removeSpotFromDay: (spotId, dayId) => {
      set((s) => ({
        dailyPlans: s.dailyPlans.map((d) =>
          d.id === dayId ? { ...d, spotOrder: d.spotOrder.filter((id) => id !== spotId) } : d,
        ),
      }))
      get().invalidateTrip()
    },

    moveSpotBetweenDays: (spotId, fromDayId, toDayId) => {
      if (fromDayId === toDayId) return
      set((s) => ({
        dailyPlans: s.dailyPlans.map((d) => {
          if (d.id === fromDayId) return { ...d, spotOrder: d.spotOrder.filter((id) => id !== spotId) }
          if (d.id === toDayId) return d.spotOrder.includes(spotId) ? d : { ...d, spotOrder: [...d.spotOrder, spotId] }
          return d
        }),
      }))
      get().invalidateTrip()
    },

    ensureDaysForDateRange: () => {
      const s = get()
      let daysCount = 3
      if (s.tripStart && s.tripEnd) {
        const start = new Date(s.tripStart)
        const end = new Date(s.tripEnd)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          daysCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
        }
      }
      if (daysCount > 14) {
        useLogStore.getState().pushLog(`行程跨度 ${daysCount} 天太长,自动只创建前 14 天。`, 'warn')
        daysCount = 14
      }
      if (daysCount < 1) daysCount = 1
      const existing = s.dailyPlans.length
      if (existing >= daysCount) return existing
      const cityId = s.cities[0]?.id ?? ''
      const startDate = s.tripStart ? new Date(s.tripStart) : null
      const newDays: DailyPlan[] = []
      for (let i = existing; i < daysCount; i++) {
        const dayDate = startDate ? new Date(startDate.getTime() + i * 86400000).toISOString().slice(0, 10) : undefined
        newDays.push({ id: uid('day'), dayIndex: i + 1, date: dayDate, cityId, lodging: {}, spotOrder: [] })
      }
      set({ dailyPlans: [...s.dailyPlans, ...newDays] })
      useLogStore.getState().pushLog(`已自动创建 ${newDays.length} 天空白行程,可以开始安排了。`)
      get().bumpMapRedraw()
      return s.dailyPlans.length + newDays.length
    },

    confirmAutoSeed: () => {
      const pending = get().autoSeedPending
      if (!pending) return
      const { city, pois } = pending
      const existing = get().spots
      const { spots, added } = convertAmapPois(pois, city.id, existing, 'spot_amap_seed')
      set({ spots, autoSeedPending: null })
      useLogStore.getState().pushLog(
        added
          ? `已为城市「${city.name}」自动加入 ${added} 个来自高德的候选景点，可在景点池中进一步筛选。`
          : '自动加入高德景点时未发现新的候选点（可能都已存在）。',
      )
      get().scheduleAiRefresh()
    },

    cancelAutoSeed: () => {
      set({ autoSeedPending: null })
      useLogStore.getState().pushLog('已取消自动加入高德景点，你可以稍后在景点池中手动获取。')
    },

    loadDemoData: () => {
      set({
        cities: [...DEMO_CITIES],
        spots: [...DEMO_SPOTS],
        dailyPlans: DEMO_DAILY_PLANS.map((d) => ({ ...d, spotOrder: [...d.spotOrder] })),
        tripTitle: DEMO_TRIP_META.title,
        tripStart: DEMO_TRIP_META.start,
        tripEnd: DEMO_TRIP_META.end,
        tripExpectation: DEMO_TRIP_META.expectation,
        tripType: DEMO_TRIP_META.type,
        autoSeedPending: null,
        mapFocusDayId: null,
        mapFocusSpotId: null,
      } as Partial<TripCoreState>)
      useLogStore.getState().pushLog('已加载示例数据：杭州 3 天，含 8 个景点（3 个已分配到 Day 1）。')
      get().bumpMapRedraw()
    },
  }
}
