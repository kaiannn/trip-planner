import { createContext, useContext } from 'react'
import type { City } from '../types'

export type MapApi = {
  geocodeCity: (city: City) => void
  redraw: () => void
}

export const MapContext = createContext<MapApi | null>(null)

export function useMapApi() {
  return useContext(MapContext)
}
