export interface City {
  id: string
  name: string
  location?: { lat: number; lng: number }
  order: number
}

/** Which category of place this is. Drives colors, icons, and which fields render. */
export type SpotKind = 'sight' | 'hotel' | 'restaurant'

/**
 * Fields every pool item shares regardless of kind.
 * Image (URL or local blob), description ("note"), location, etc.
 * innerTransport is kept here because the user wants it on hotels
 * and restaurants too (useful for "how do I get there from my hotel").
 */
interface BaseSpot {
  id: string
  cityId: string
  name: string
  location: { lat: number; lng: number }
  innerTransport?: string
  imageUrl?: string
  /**
   * Client-local ID for an image Blob stored in IndexedDB
   * (see lib/imageStorage.ts). When both imageUrl and imageBlobId are
   * present, the blob takes precedence.
   */
  imageBlobId?: string
  description?: string
}

export interface SightSpot extends BaseSpot {
  kind: 'sight'
  guideUrl?: string
  visitTimeText?: string
  videoUrl?: string
  xiaohongshuUrls?: string[]
}

export interface HotelSpot extends BaseSpot {
  kind: 'hotel'
  /** Free-form price tag, e.g. "¥400/晚" or "约 350/晚,含早". */
  price?: string
}

export interface RestaurantSpot extends BaseSpot {
  kind: 'restaurant'
  /** e.g. reservation link, menu link, 点评 URL. */
  link?: string
}

/**
 * A pool item. TypeScript narrows to one of the three kinds once you
 * check `spot.kind`, so `spot.price` is accessible only on hotels and
 * `spot.link` only on restaurants.
 */
export type Spot = SightSpot | HotelSpot | RestaurantSpot

export interface DailyLodging {
  name?: string
  address?: string
}

/** Which routing mode to use between two consecutive stops within a day. */
export type TransportMode = 'driving' | 'walking' | 'transit' | 'riding'

export interface DailyPlan {
  id: string
  dayIndex: number
  date?: string
  cityId: string
  lodging: DailyLodging
  spotOrder: string[]
  transportMode?: string
  /**
   * Per-segment transport mode override, keyed by "<spotId>|<spotId>"
   * (source|destination in the day's spotOrder). Missing key defaults to
   * 'driving'. Stored on the DailyPlan so a spot assigned to two days
   * can still have different modes on each day's leg.
   */
  segmentModes?: Record<string, TransportMode>
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

/**
 * One AI-suggested candidate spot for the Pool seeding flow.
 * Lightweight; AI returns just enough info to geocode + add to pool.
 */
export interface AiPoolCandidate {
  name: string
  cityHint?: string
  address?: string
  description?: string
  lat?: number
  lng?: number
  kind?: SpotKind
  price?: string
  link?: string
}
