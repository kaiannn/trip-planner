import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clampAvgSpeed,
  createStopId,
  defaultStopKindAfter,
} from './routeMath'
import { planRouteBookSegments, searchNearbyPois } from './amapCycling'
import type {
  CyclingLatLng,
  CyclingNearbyPoi,
  CyclingSegment,
  CyclingStop,
  CyclingStopKind,
} from './types'

export interface CyclingState {
  open: boolean
  title: string
  stops: CyclingStop[]
  segments: CyclingSegment[]
  plannedPath: number[][]
  totalDistance: number
  totalDurationSec: number
  avgSpeedKmh: number
  departTime: string
  notes: string
  planning: boolean
  planError: string | null
  statusMsg: string | null
  /** 周边搜索：以该 stop 为圆心 */
  nearbyAnchorStopId: string | null
  nearbyKind: CyclingStopKind
  nearbyKeywords: string
  nearbyLoading: boolean
  nearbyError: string | null
  nearbyResults: CyclingNearbyPoi[]
}

export interface CyclingActions {
  setOpen: (open: boolean) => void
  setTitle: (v: string) => void
  setField: (
    field: 'avgSpeedKmh' | 'departTime' | 'notes',
    value: string | number,
  ) => void
  resetRouteBook: () => void
  addStop: (partial?: Partial<CyclingStop>) => string
  updateStop: (id: string, patch: Partial<CyclingStop>) => void
  removeStop: (id: string) => void
  moveStop: (id: string, delta: -1 | 1) => void
  setStopKind: (id: string, kind: CyclingStopKind) => void
  ensureStartEnd: () => void
  planRoute: () => Promise<void>
  openNearby: (stopId: string, kind?: CyclingStopKind) => void
  closeNearby: () => void
  setNearbyKeywords: (v: string) => void
  searchNearby: () => Promise<void>
  addNearbyAsStop: (poi: CyclingNearbyPoi) => void
}

const initialCyclingState: CyclingState = {
  open: false,
  title: '我的骑行路书',
  stops: [],
  segments: [],
  plannedPath: [],
  totalDistance: 0,
  totalDurationSec: 0,
  avgSpeedKmh: 20,
  departTime: '08:00',
  notes: '',
  planning: false,
  planError: null,
  statusMsg: null,
  nearbyAnchorStopId: null,
  nearbyKind: 'supply',
  nearbyKeywords: '便利店',
  nearbyLoading: false,
  nearbyError: null,
  nearbyResults: [],
}

function emptyStartEnd(): CyclingStop[] {
  return [
    { id: createStopId(), kind: 'start', name: '起点' },
    { id: createStopId(), kind: 'end', name: '终点' },
  ]
}

function locatedPairs(
  stops: CyclingStop[],
): { id: string; location: CyclingLatLng }[] {
  return stops
    .filter((s): s is CyclingStop & { location: CyclingLatLng } => Boolean(s.location))
    .map((s) => ({ id: s.id, location: s.location }))
}

export const useCyclingStore = create<CyclingState & CyclingActions>()(
  persist(
    (set, get) => ({
      ...initialCyclingState,
      stops: emptyStartEnd(),

      setOpen: (open) => set({ open }),

      setTitle: (v) => set({ title: v }),

      setField: (field, value) => {
        if (field === 'avgSpeedKmh') {
          set({ avgSpeedKmh: clampAvgSpeed(Number(value)) })
        } else if (field === 'departTime') {
          set({ departTime: String(value) })
        } else {
          set({ notes: String(value) })
        }
      },

      resetRouteBook: () =>
        set({
          title: '我的骑行路书',
          stops: emptyStartEnd(),
          segments: [],
          plannedPath: [],
          totalDistance: 0,
          totalDurationSec: 0,
          avgSpeedKmh: 20,
          departTime: '08:00',
          notes: '',
          planError: null,
          statusMsg: null,
          nearbyResults: [],
          nearbyAnchorStopId: null,
        }),

      addStop: (partial) => {
        const id = createStopId()
        const stops = get().stops
        const last = stops[stops.length - 1]
        const kind: CyclingStopKind = partial?.kind ?? defaultStopKindAfter(last?.kind ?? 'checkpoint')
        const stop: CyclingStop = {
          id,
          kind,
          name: partial?.name || '途经点',
          location: partial?.location,
          note: partial?.note,
          address: partial?.address,
          amapPoiId: partial?.amapPoiId,
        }
        // 插在终点前
        if (last?.kind === 'end') {
          set({ stops: [...stops.slice(0, -1), stop, last] })
        } else {
          set({ stops: [...stops, stop] })
        }
        return id
      },

      updateStop: (id, patch) =>
        set((s) => ({
          stops: s.stops.map((st) => (st.id === id ? { ...st, ...patch, id: st.id } : st)),
        })),

      removeStop: (id) =>
        set((s) => {
          const target = s.stops.find((st) => st.id === id)
          if (target?.kind === 'start' || target?.kind === 'end') return s
          return {
            stops: s.stops.filter((st) => st.id !== id),
            nearbyAnchorStopId:
              s.nearbyAnchorStopId === id ? null : s.nearbyAnchorStopId,
          }
        }),

      moveStop: (id, delta) =>
        set((s) => {
          const idx = s.stops.findIndex((st) => st.id === id)
          if (idx < 0) return s
          const target = s.stops[idx]
          if (target.kind === 'start' || target.kind === 'end') return s
          const next = idx + delta
          // 不越过 start/end
          if (next < 1) return s
          const endIndex = s.stops.findIndex((st) => st.kind === 'end')
          const maxMid = endIndex >= 0 ? endIndex - 1 : s.stops.length - 1
          if (next > maxMid) return s
          const arr = s.stops.slice()
          arr.splice(idx, 1)
          arr.splice(next, 0, target)
          return { stops: arr }
        }),

      setStopKind: (id, kind) =>
        set((s) => ({
          stops: s.stops.map((st) => (st.id === id ? { ...st, kind } : st)),
        })),

      ensureStartEnd: () => {
        const stops = get().stops
        if (stops.length === 0) {
          set({ stops: emptyStartEnd() })
          return
        }
        const hasStart = stops.some((s) => s.kind === 'start')
        const hasEnd = stops.some((s) => s.kind === 'end')
        const next = stops.slice()
        if (!hasStart) next.unshift({ id: createStopId(), kind: 'start', name: '起点' })
        if (!hasEnd) next.push({ id: createStopId(), kind: 'end', name: '终点' })
        set({ stops: next })
      },

      planRoute: async () => {
        const { stops } = get()
        const located = locatedPairs(stops)
        if (located.length < 2) {
          set({
            planError: '请先为起点和终点设置坐标（搜索并选择地点）',
            statusMsg: null,
          })
          return
        }
        set({ planning: true, planError: null, statusMsg: '正在规划骑行路线…' })
        try {
          const result = await planRouteBookSegments(located, (done, total) => {
            set({
              statusMsg:
                total <= 1
                  ? '正在规划骑行路线…'
                  : `正在规划分段 ${done + 1}/${total}…`,
            })
          })
          set({
            segments: result.segments,
            plannedPath: result.plannedPath,
            totalDistance: result.totalDistance,
            totalDurationSec: result.totalDurationSec,
            planning: false,
            statusMsg: '路线已更新',
            planError: null,
          })
        } catch (e) {
          set({
            planning: false,
            planError: e instanceof Error ? e.message : '规划失败',
            statusMsg: null,
          })
        }
      },

      openNearby: (stopId, kind) => {
        const stop = get().stops.find((s) => s.id === stopId)
        if (!stop?.location) {
          set({ planError: '该节点没有坐标，无法周边搜索' })
          return
        }
        const k = kind ?? (stop.kind === 'start' || stop.kind === 'end' ? 'supply' : stop.kind)
        set({
          nearbyAnchorStopId: stopId,
          nearbyKind: k,
          nearbyKeywords:
            k === 'supply'
              ? '便利店'
              : k === 'repair'
                ? '自行车维修'
                : k === 'overnight'
                  ? '酒店'
                  : k === 'checkpoint'
                    ? '观景台'
                    : '便利店',
          nearbyError: null,
          nearbyResults: [],
          nearbyLoading: false,
        })
      },

      closeNearby: () =>
        set({
          nearbyAnchorStopId: null,
          nearbyResults: [],
          nearbyError: null,
          nearbyLoading: false,
        }),

      setNearbyKeywords: (v) => set({ nearbyKeywords: v }),

      searchNearby: async () => {
        const { nearbyAnchorStopId, nearbyKeywords, stops } = get()
        const anchor = stops.find((s) => s.id === nearbyAnchorStopId)
        if (!anchor?.location) {
          set({ nearbyError: '锚点节点缺少坐标' })
          return
        }
        set({ nearbyLoading: true, nearbyError: null, nearbyResults: [] })
        try {
          const results = await searchNearbyPois({
            location: anchor.location,
            keywords: nearbyKeywords,
          })
          set({ nearbyResults: results, nearbyLoading: false })
        } catch (e) {
          set({
            nearbyLoading: false,
            nearbyError: e instanceof Error ? e.message : '搜索失败',
          })
        }
      },

      addNearbyAsStop: (poi) => {
        const { nearbyAnchorStopId, nearbyKind, stops } = get()
        const anchorIdx = stops.findIndex((s) => s.id === nearbyAnchorStopId)
        if (anchorIdx < 0) return
        const stop: CyclingStop = {
          id: createStopId(),
          kind: nearbyKind === 'start' || nearbyKind === 'end' ? 'supply' : nearbyKind,
          name: poi.name,
          location: { ...poi.location },
          address: poi.address,
          note: poi.distance != null ? `距锚点约 ${poi.distance} m` : undefined,
          amapPoiId: poi.id,
        }
        const next = stops.slice()
        next.splice(anchorIdx + 1, 0, stop)
        set({
          stops: next,
          nearbyResults: [],
          nearbyAnchorStopId: null,
          statusMsg: `已加入节点「${poi.name}」，可重新规划路线`,
        })
      },
    }),
    {
      name: 'trip-planner-cycling-routebook',
      partialize: (s) => ({
        title: s.title,
        stops: s.stops,
        segments: s.segments,
        plannedPath: s.plannedPath,
        totalDistance: s.totalDistance,
        totalDurationSec: s.totalDurationSec,
        avgSpeedKmh: s.avgSpeedKmh,
        departTime: s.departTime,
        notes: s.notes,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CyclingState>
        const stops =
          Array.isArray(p.stops) && p.stops.length >= 2
            ? p.stops
            : emptyStartEnd()
        return {
          ...current,
          ...p,
          stops,
          open: false,
          planning: false,
          planError: null,
          statusMsg: null,
          nearbyLoading: false,
          nearbyResults: [],
          nearbyAnchorStopId: null,
          nearbyError: null,
        }
      },
    },
  ),
)

/** 导出用：取当前路书快照 */
export function snapshotRouteBook() {
  const s = useCyclingStore.getState()
  return {
    title: s.title,
    stops: s.stops,
    segments: s.segments,
    totalDistance: s.totalDistance,
    avgSpeedKmh: s.avgSpeedKmh,
    departTime: s.departTime,
    notes: s.notes,
  }
}

export type { CyclingLatLng }
