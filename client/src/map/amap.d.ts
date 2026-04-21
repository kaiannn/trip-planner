declare namespace AMap {
  class Map {
    constructor(container: HTMLElement, opts?: MapOptions)
    add(overlay: Overlay | Overlay[]): void
    on(event: string, handler: (e: MapEvent) => void): void
    setFitView(overlays?: Overlay[]): void
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
  }

  class Polyline {
    constructor(opts?: PolylineOptions)
    setMap(map: Map | null): void
  }

  interface PolylineOptions {
    path?: number[][]
    strokeColor?: string
    strokeWeight?: number
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
    setContent(content: string): void
    open(map: Map, position: LngLat): void
  }

  interface InfoWindowOptions {
    offset?: Pixel
  }

  class Geocoder {
    constructor(opts?: { city?: string })
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
  }

  function plugin(name: string, callback: () => void): void
}

interface Window {
  AMap: typeof AMap
  _AMapSecurityConfig?: { securityJsCode: string }
}
