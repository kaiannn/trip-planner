/** 骑行路书独立类型 — 不与主行程 Spot/DailyPlan 耦合 */

export type CyclingStopKind =
  | 'start'
  | 'checkpoint'
  | 'supply'
  | 'repair'
  | 'warn'
  | 'overnight'
  | 'end'

export const CYCLING_STOP_KIND_LABEL: Record<CyclingStopKind, string> = {
  start: '起点',
  checkpoint: '打卡',
  supply: '补给',
  repair: '维修',
  warn: '注意',
  overnight: '过夜',
  end: '终点',
}

export const CYCLING_STOP_KIND_ICON: Record<CyclingStopKind, string> = {
  start: '🚩',
  checkpoint: '⛰️',
  supply: '🏪',
  repair: '🔧',
  warn: '⚠️',
  overnight: '🏨',
  end: '🏁',
}

export interface CyclingLatLng {
  lat: number
  lng: number
}

export interface CyclingStop {
  id: string
  kind: CyclingStopKind
  name: string
  location?: CyclingLatLng
  note?: string
  address?: string
  /** 高德周边搜索候选的 poi id（可选） */
  amapPoiId?: string
}

export interface CyclingSegment {
  fromId: string
  toId: string
  /** 高德骑行距离（米） */
  distance: number
  /** 高德预估秒数 */
  duration: number
  /** [[lng, lat], ...] */
  path: number[][]
}

export interface CyclingRouteBook {
  title: string
  /** 有序节点；首尾一般为 start/end */
  stops: CyclingStop[]
  /** 分段规划结果 */
  segments: CyclingSegment[]
  /** 拼接后的完整路径 [[lng,lat],...] */
  plannedPath: number[][]
  /** 总里程（米） */
  totalDistance: number
  /** 高德预估总时长（秒） */
  totalDurationSec: number
  /** 自定义均速 km/h，用于时间线估算 */
  avgSpeedKmh: number
  /** 出发时刻 HH:mm */
  departTime: string
  notes?: string
  updatedAt?: string
}

export interface CyclingNearbyPoi {
  id: string
  name: string
  address?: string
  location: CyclingLatLng
  type?: string
  distance?: number
}
