import { useTripStore } from '../store'
import { useLogStore } from '../store/logStore'

export interface TripExportPayload {
  version: 1
  exportedAt: string
  tripTitle: string
  tripStart: string
  tripEnd: string
  tripExpectation: string
  tripType: string
  cities: ReturnType<typeof useTripStore.getState>['cities']
  spots: ReturnType<typeof useTripStore.getState>['spots']
  dailyPlans: ReturnType<typeof useTripStore.getState>['dailyPlans']
}

export function buildTripExport(): TripExportPayload {
  const s = useTripStore.getState()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tripTitle: s.tripTitle,
    tripStart: s.tripStart,
    tripEnd: s.tripEnd,
    tripExpectation: s.tripExpectation,
    tripType: s.tripType,
    cities: s.cities,
    spots: s.spots,
    dailyPlans: s.dailyPlans,
  }
}

/** Download current trip as a JSON file (localStorage escape hatch). */
export function exportTripJson(): boolean {
  const data = buildTripExport()
  if (!data.cities.length && !data.spots.length && !data.dailyPlans.length && !data.tripTitle) {
    useLogStore.getState().pushLog('当前没有可导出的行程数据。', 'warn')
    return false
  }
  const stamp = data.exportedAt.slice(0, 10)
  const base = (data.tripTitle || 'trip').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40)
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  useLogStore.getState().pushLog(`已导出行程 JSON：${a.download}`)
  return true
}
