import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { AiCard } from './AiCard'
import { MapContext, type MapApi } from '../map/MapContext'
import { distanceInMeters } from '../lib/geo'
import { useTripStore } from '../store/tripStore'
import type { City, Spot } from '../types'

const DAY_COLORS = [
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
]

export function MapPanel({
  sidebar,
  className,
}: {
  sidebar: React.ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const cityMarkersRef = useRef<unknown[]>([])
  const spotMarkersRef = useRef<unknown[]>([])
  const routePolylinesRef = useRef<unknown[]>([])
  const distanceLabelsRef = useRef<unknown[]>([])
  const infoWindowRef = useRef<unknown>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [legend, setLegend] = useState<
    { key: string; color: string; label: string; dashed?: boolean }[]
  >([])

  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const mapRedrawNonce = useTripStore((s) => s.mapRedrawNonce)
  const updateCityLocation = useTripStore((s) => s.updateCityLocation)
  const setPendingMapCoords = useTripStore((s) => s.setPendingMapCoords)
  const pushLog = useTripStore((s) => s.pushLog)

  const drawRoutes = useCallback(
    (map: any, focusDayId: string | null) => {
      routePolylinesRef.current.forEach((p: any) => p.setMap(null))
      routePolylinesRef.current = []
      distanceLabelsRef.current.forEach((t: any) => t.setMap(null))
      distanceLabelsRef.current = []
      const leg: { key: string; color: string; label: string; dashed?: boolean }[] = []

      if (!cities.length && !dailyPlans.length) {
        setLegend([])
        return
      }

      const AMap = window.AMap
      const sortedCities = cities.slice().sort((a, b) => a.order - b.order)
      const cityPath = sortedCities
        .filter((c) => c.location)
        .map((c) => [c.location!.lng, c.location!.lat])
      if (cityPath.length >= 2) {
        const line = new AMap.Polyline({
          path: cityPath,
          strokeColor: '#64748b',
          strokeWeight: 4,
          strokeStyle: 'dashed',
        })
        map.add(line)
        routePolylinesRef.current.push(line)
        leg.push({
          key: 'city',
          color: '#64748b',
          label: '城市间移动',
          dashed: true,
        })
      }

      const daysToDraw = focusDayId
        ? dailyPlans.filter((d) => d.id === focusDayId)
        : dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex)

      daysToDraw.forEach((day, idx) => {
        const coords: number[][] = []
        const orderedSpots: Spot[] = []
        day.spotOrder.forEach((sid) => {
          const spot = spots.find((s) => s.id === sid)
          if (spot?.location) {
            coords.push([spot.location.lng, spot.location.lat])
            orderedSpots.push(spot)
          }
        })
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        if (coords.length >= 2) {
          const line = new AMap.Polyline({
            path: coords,
            strokeColor: color,
            strokeWeight: 4,
          })
          map.add(line)
          routePolylinesRef.current.push(line)
          for (let i = 0; i < orderedSpots.length - 1; i++) {
            const a = orderedSpots[i].location
            const b = orderedSpots[i + 1].location
            const d = distanceInMeters(a.lat, a.lng, b.lat, b.lng)
            const midLng = (a.lng + b.lng) / 2
            const midLat = (a.lat + b.lat) / 2
            const label = new AMap.Text({
              text: `${(d / 1000).toFixed(1)} km`,
              position: [midLng, midLat],
              style: {
                'background-color': 'rgba(255,255,255,0.9)',
                'border-radius': '4px',
                padding: '2px 4px',
                'font-size': '10px',
                border: `1px solid ${color}`,
                color,
              },
            })
            map.add(label)
            distanceLabelsRef.current.push(label)
          }
        }
        if (coords.length >= 1) {
          const city = cities.find((c) => c.id === day.cityId)
          leg.push({
            key: day.id,
            color,
            label: `第${day.dayIndex}天${city ? ` · ${city.name}` : ''}`,
          })
        }
      })

      setLegend(leg)

      cityMarkersRef.current.forEach((m: any) => m.setMap(null))
      cityMarkersRef.current = []
      sortedCities.forEach((city) => {
        if (!city.location) return
        const marker = new AMap.Marker({
          position: [city.location.lng, city.location.lat],
          title: city.name,
          map,
        })
        marker.on('click', () => {
          ;(infoWindowRef.current as any)?.setContent(`<div>城市：${city.name}</div>`)
          ;(infoWindowRef.current as any)?.open(map, marker.getPosition())
        })
        cityMarkersRef.current.push(marker)
      })

      spotMarkersRef.current.forEach((m: any) => m.setMap(null))
      spotMarkersRef.current = []
      spots.forEach((spot) => {
        const marker = new AMap.Marker({
          position: [spot.location.lng, spot.location.lat],
          title: spot.name,
          map,
        })
        const inner = spot.innerTransport ? `<br/>交通：${spot.innerTransport}` : ''
        const guide = spot.guideUrl
          ? `<br/><a href="${spot.guideUrl}" target="_blank">攻略链接</a>`
          : ''
        marker.on('click', () => {
          ;(infoWindowRef.current as any)?.setContent(
            `<div>景点：${spot.name}${spot.visitTimeText ? `<br/>时间：${spot.visitTimeText}` : ''}${inner}${guide}</div>`,
          )
          ;(infoWindowRef.current as any)?.open(map, marker.getPosition())
        })
        spotMarkersRef.current.push(marker)
      })

      const overlays = [
        ...cityMarkersRef.current,
        ...spotMarkersRef.current,
        ...routePolylinesRef.current,
      ].filter(Boolean)
      if (overlays.length) {
        map.setFitView(overlays)
      }
    },
    [cities, spots, dailyPlans],
  )

  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY || 'YOUR_AMAP_KEY'
    if (key === 'YOUR_AMAP_KEY') {
      pushLog('请在 client/.env 设置 VITE_AMAP_KEY，否则地图无法加载。', 'warn')
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`
    script.async = true
    script.onload = () => setScriptReady(true)
    document.body.appendChild(script)
    return () => {
      script.remove()
    }
  }, [pushLog])

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !(window as any).AMap) return
    const AMap = (window as any).AMap
    const map = new AMap.Map(containerRef.current, {
      viewMode: '2D',
      zoom: 4,
      center: [110.0, 34.0],
    })
    mapRef.current = map
    infoWindowRef.current = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30) })
    AMap.plugin('AMap.Geocoder', () => {})

    map.on('rightclick', (e: { lnglat: { getLat: () => number; getLng: () => number } }) => {
      const lnglat = e.lnglat
      const lat = lnglat.getLat()
      const lng = lnglat.getLng()
      setPendingMapCoords({ lat, lng })
      pushLog(`已记录经纬度（可填入表单）：${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    })

    return () => {
      if (typeof (map as any).destroy === 'function') {
        ;(map as any).destroy()
      }
      mapRef.current = null
    }
  }, [scriptReady, pushLog, setPendingMapCoords])

  useEffect(() => {
    const map = mapRef.current as any
    if (!map) return
    drawRoutes(map, mapFocusDayId)
  }, [drawRoutes, mapFocusDayId, cities, spots, dailyPlans, mapRedrawNonce])

  const geocodeCity = useCallback(
    (city: City) => {
      const map = mapRef.current as any
      const AMap = (window as any).AMap
      if (!map || !AMap?.Geocoder) {
        pushLog(`当前环境不支持自动定位城市【${city.name}】的经纬度。`, 'warn')
        return
      }
      const geocoder = new AMap.Geocoder({ city: '全国' })
      geocoder.getLocation(
        city.name,
        (status: string, result: { info: string; geocodes: { location: { lng: number; lat: number } }[] }) => {
          if (status === 'complete' && result.info === 'OK' && result.geocodes?.length) {
            const loc = result.geocodes[0].location
            updateCityLocation(city.id, loc.lat, loc.lng)
            pushLog(
              `已根据城市名自动定位：${city.name} -> (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
            )
            const m = mapRef.current as any
            if (m) drawRoutes(m, useTripStore.getState().mapFocusDayId)
          } else {
            pushLog(`无法根据城市名自动获取经纬度：${city.name}，请手动填写。`, 'warn')
          }
        },
      )
    },
    [drawRoutes, pushLog, updateCityLocation],
  )

  const redraw = useCallback(() => {
    const m = mapRef.current as any
    if (m) drawRoutes(m, useTripStore.getState().mapFocusDayId)
  }, [drawRoutes])

  const api = useMemo<MapApi>(() => ({ geocodeCity, redraw }), [geocodeCity, redraw])

  return (
    <MapContext.Provider value={api}>
      <div className={clsx('flex min-h-0 flex-1 gap-4', className)}>
        <div className="w-[min(340px,34vw)] shrink-0">{sidebar}</div>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-md ring-1 ring-slate-900/[0.04]">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
            {legend.map((item) => (
              <div
                key={item.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2 py-0.5 shadow-sm"
              >
                <span
                  className="h-1 w-4 rounded-full"
                  style={{
                    background: item.color,
                    borderStyle: item.dashed ? 'dashed' : undefined,
                  }}
                />
                <span className="font-medium text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="relative min-h-[280px] w-full flex-1">
            <div ref={containerRef} className="absolute inset-0" />
            <AiCard />
          </div>
        </div>
      </div>
    </MapContext.Provider>
  )
}

declare global {
  interface Window {
    AMap: any
  }
}
