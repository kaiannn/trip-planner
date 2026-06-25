import { useMemo } from 'react'
import type { City, DailyPlan, Spot } from '../types'

export function useSortedCities(cities: City[]) {
  return useMemo(() => cities.slice().sort((a, b) => a.order - b.order), [cities])
}

export function useAssignedSpotIds(dailyPlans: DailyPlan[]) {
  return useMemo(() => {
    const set = new Set<string>()
    dailyPlans.forEach((d) => d.spotOrder.forEach((id) => set.add(id)))
    return set
  }, [dailyPlans])
}

export function useUnassignedSpots(spots: Spot[], assignedIds: Set<string>) {
  return useMemo(
    () => spots.filter((s) => !assignedIds.has(s.id)),
    [spots, assignedIds],
  )
}
