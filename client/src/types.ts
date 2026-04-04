export interface City {
  id: string
  name: string
  location?: { lat: number; lng: number }
  order: number
}

export interface Spot {
  id: string
  cityId: string
  name: string
  location: { lat: number; lng: number }
  guideUrl?: string
  visitTimeText?: string
  innerTransport?: string
  imageUrl?: string
  description?: string
  videoUrl?: string
  xiaohongshuUrls?: string[]
}

export interface DailyLodging {
  name?: string
  address?: string
}

export interface DailyPlan {
  id: string
  dayIndex: number
  date?: string
  cityId: string
  lodging: DailyLodging
  spotOrder: string[]
  transportMode?: string
}

export interface AiItem {
  title?: string
  summary?: string
  detail?: string
  meta?: string
  lat?: number
  lng?: number
  guideUrl?: string
  innerTransport?: string
  priceLevel?: string
}

export interface AiSection {
  id?: string
  title?: string
  type?: string
  items?: AiItem[]
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  time: string
  level: LogLevel
  message: string
}

export type AiFocus = 'all' | 'spots' | 'lodging'
