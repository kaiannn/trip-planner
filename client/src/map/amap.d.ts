declare namespace AMap {
  class Map {
    constructor(container: HTMLElement, opts?: MapOptions)
    add(overlay: Overlay | Overlay[]): void
    on(event: string, handler: (e: MapEvent) => void): void
    setFitView(overlays?: Overlay[]): void
    setCenter(position: [number, number] | LngLat, immediately?: boolean): void
    panTo(position: [number, number] | LngLat): void
    getZoom(): number
    setZoom(zoom: number): void
    resize(): void
    destroy(): void
  }

  interface MapOptions {
    viewMode?: '2D' | '3D'
    zoom?: number
    center?: [number, number]
  }

  interface MapEvent {
    lnglat: LngLat
  }

  class LngLat {
    constructor(lng: number, lat: number)
    getLng(): number
    getLat(): number
  }

  class Pixel {
    constructor(x: number, y: number)
  }

  type Overlay = Marker | Polyline | Text | InfoWindow

  class Marker {
    constructor(opts?: MarkerOptions)
    setMap(map: Map | null): void
    getPosition(): LngLat
    on(event: string, handler: () => void): void
  }

  interface MarkerOptions {
    position?: [number, number]
    title?: string
    map?: Map
    icon?: string | Icon
    label?: { content: string; direction?: 'top' | 'bottom' | 'left' | 'right' }
    zIndex?: number
    offset?: Pixel
  }

  interface IconOptions {
    size?: Size
    imageSize?: Size
    image?: string
  }

  class Icon {
    constructor(opts?: IconOptions)
  }

  class Size {
    constructor(w: number, h: number)
  }

  class Polyline {
    constructor(opts?: PolylineOptions)
    setMap(map: Map | null): void
    on(event: string, handler: (e: MapEvent) => void): void
  }

  interface PolylineOptions {
    path?: number[][]
    strokeColor?: string
    strokeWeight?: number
    strokeOpacity?: number
    strokeStyle?: 'solid' | 'dashed'
  }

  class Text {
    constructor(opts?: TextOptions)
    setMap(map: Map | null): void
  }

  interface TextOptions {
    text?: string
    position?: [number, number]
    style?: Record<string, string>
  }

  class InfoWindow {
    constructor(opts?: InfoWindowOptions)
    setContent(content: string | HTMLElement): void
    open(map: Map, position: LngLat): void
    close(): void
  }

  interface InfoWindowOptions {
    offset?: Pixel
  }

  interface ReverseGeocodeRegeocode {
    formatted_address?: string
    addressComponent?: {
      province?: string
      city?: string
      district?: string
      township?: string
      neighborhood?: { name?: string }
      building?: { name?: string }
      streetNumber?: { street?: string; number?: string }
    }
    pois?: { id?: string; name?: string; type?: string; distance?: string | number }[]
  }

  interface GeolocationResult {
    info: string
    position: LngLat
    accuracy?: number
    formattedAddress?: string
  }

  class Geolocation {
    constructor(opts?: {
      enableHighAccuracy?: boolean
      timeout?: number
      showButton?: boolean
      showMarker?: boolean
      showCircle?: boolean
    })
    getCurrentPosition(
      callback: (status: string, result: GeolocationResult) => void,
    ): void
  }

  interface WeatherLive {
    city: string
    weather: string
    temperature: string | number
    winddirection?: string
    windpower?: string
    humidity?: string | number
    reporttime?: string
  }

  interface WeatherForecastCast {
    date: string
    dayweather: string
    nightweather: string
    daytemp: string | number
    nighttemp: string | number
    daywind?: string
    nightwind?: string
  }

  interface WeatherForecast {
    city: string
    reporttime?: string
    forecasts: WeatherForecastCast[]
  }

  class Weather {
    constructor()
    getLive(
      city: string,
      callback: (err: Error | null, data: WeatherLive) => void,
    ): void
    getForecast(
      city: string,
      callback: (err: Error | null, data: WeatherForecast) => void,
    ): void
  }

  class Geocoder {
    constructor(opts?: { city?: string; radius?: number; extensions?: 'base' | 'all' })
    getLocation(
      address: string,
      callback: (
        status: string,
        result: {
          info: string
          geocodes: { location: { lng: number; lat: number } }[]
        },
      ) => void,
    ): void
    getAddress(
      location: [number, number] | LngLat,
      callback: (
        status: string,
        result: { info: string; regeocode?: ReverseGeocodeRegeocode },
      ) => void,
    ): void
  }

  interface DrivingStep {
    path: { lng: number; lat: number }[]
  }

  interface DrivingRoute {
    distance: number
    time: number
    steps: DrivingStep[]
  }

  interface DrivingResult {
    info?: string
    routes?: DrivingRoute[]
  }

  class Driving {
    constructor(opts?: { policy?: number; hideMarkers?: boolean })
    search(
      origin: [number, number],
      destination: [number, number],
      callback: (status: string, result: DrivingResult) => void,
    ): void
  }

  class Walking {
    constructor(opts?: { hideMarkers?: boolean })
    search(
      origin: [number, number],
      destination: [number, number],
      callback: (status: string, result: DrivingResult) => void,
    ): void
  }

  class Riding {
    constructor(opts?: { hideMarkers?: boolean })
    search(
      origin: [number, number],
      destination: [number, number],
      callback: (status: string, result: DrivingResult) => void,
    ): void
  }

  interface TransferSegment {
    distance?: number
    time?: number
    transit_mode?: string
    path?: { lng: number; lat: number }[]
  }

  interface TransferPlan {
    distance: number
    time: number
    segments?: TransferSegment[]
  }

  interface TransferResult {
    info?: string
    plans?: TransferPlan[]
  }

  class Transfer {
    constructor(opts?: { city?: string; hideMarkers?: boolean })
    search(
      origin: [number, number],
      destination: [number, number],
      callback: (status: string, result: TransferResult) => void,
    ): void
  }

  interface AutoCompleteTip {
    id?: string
    name: string
    district?: string
    adcode?: string
    address?: string | string[]
    location?: { lng: number; lat: number } | string
    typecode?: string
  }

  interface AutoCompleteResult {
    info: string
    count?: number
    tips: AutoCompleteTip[]
  }

  class AutoComplete {
    constructor(opts?: { city?: string; citylimit?: boolean; datatype?: string })
    search(
      keyword: string,
      callback: (status: string, result: AutoCompleteResult) => void,
    ): void
  }

  interface PlaceSearchPoi {
    id?: string
    name: string
    address?: string
    location?: { lng: number; lat: number } | string
    cityname?: string
    pname?: string
    adname?: string
  }

  interface PlaceSearchResult {
    info: string
    poiList?: { pois?: PlaceSearchPoi[] }
  }

  class PlaceSearch {
    constructor(opts?: { city?: string; citylimit?: boolean; pageSize?: number })
    getDetails(
      id: string,
      callback: (status: string, result: PlaceSearchResult) => void,
    ): void
    search(
      keyword: string,
      callback: (status: string, result: PlaceSearchResult) => void,
    ): void
  }

  function plugin(name: string | string[], callback: () => void): void
}

interface Window {
  AMap: typeof AMap
  _AMapSecurityConfig?: { securityJsCode: string }
}
