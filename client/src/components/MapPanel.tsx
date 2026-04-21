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
  const mapRef = useRef<AMap.Map | null>(null)
  const cityMarkersRef = useRef<AMap.Marker[]>([])
  const spotMarkersRef = useRef<AMap.Marker[]>([])
  const routePolylinesRef = useRef<AMap.Polyline[]>([])
  const distanceLabelsRef = useRef<AMap.Text[]>([])
  const infoWindowRef = useRef<AMap.InfoWindow | null>(null)
  const [scriptReady, setScriptReady] = useState(() => !!window.AMap)
  const amapKey = import.meta.env.VITE_AMAP_KEY || 'YOUR_AMAP_KEY'
  const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE || ''
  const amapKeyMissing = amapKey === 'YOUR_AMAP_KEY' || !amapKey.trim()

  const [mapLoadError, setMapLoadError] = useState<string | null>(() =>
    amapKeyMissing
      ? '未配置 VITE_AMAP_KEY：请在 client/.env 中填写高德「Web 端」Key 并重启 Vite。'
      : null,
  )
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
    (map: AMap.Map, focusDayId: string | null) => {
      routePolylinesRef.current.forEach((p) => p.setMap(null))
      routePolylinesRef.current = []
      distanceLabelsRef.current.forEach((t) => t.setMap(null))
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

      cityMarkersRef.current.forEach((m) => m.setMap(null))
      cityMarkersRef.current = []
      sortedCities.forEach((city) => {
        if (!city.location) return
        const marker = new AMap.Marker({
          position: [city.location.lng, city.location.lat],
          title: city.name,
          map,
        })
        marker.on('click', () => {
          infoWindowRef.current?.setContent(`<div>城市：${city.name}</div>`)
          infoWindowRef.current?.open(map, marker.getPosition())
        })
        cityMarkersRef.current.push(marker)
      })

      spotMarkersRef.current.forEach((m) => m.setMap(null))
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
          infoWindowRef.current?.setContent(
            `<div>景点：${spot.name}${spot.visitTimeText ? `<br/>时间：${spot.visitTimeText}` : ''}${inner}${guide}</div>`,
          )
          infoWindowRef.current?.open(map, marker.getPosition())
        })
        spotMarkersRef.current.push(marker)
      })

      const overlays: AMap.Overlay[] = [
        ...cityMarkersRef.current,
        ...spotMarkersRef.current,
        ...routePolylinesRef.current,
      ]
      if (overlays.length) {
        map.setFitView(overlays)
      }
    },
    [cities, spots, dailyPlans],
  )

  const reportMapError = useCallback(
    (msg: string) => {
      setMapLoadError(msg)
      pushLog(msg, 'error')
    },
    [pushLog],
  )

  useEffect(() => {
    if (amapKeyMissing) {
      pushLog(
        '未配置 VITE_AMAP_KEY：请在 client/.env 中填写高德「Web 端」Key 并重启 Vite。',
        'error',
      )
      return
    }

    if (amapSecurityCode) {
      window._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    } else if (import.meta.env.DEV) {
      console.info(
        '[Amap] 未设置 VITE_AMAP_SECURITY_CODE。若控制台为该 Key 启用了安全密钥，地图会失败，请在 client/.env 填写。',
      )
    }

    if (window.AMap) {
      return
    }

    const src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapKey)}&plugin=AMap.Geocoder`

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      if (!window.AMap) {
        const msg =
          '地图脚本已加载，但 window.AMap 不存在。多为 Key/安全密钥不匹配或控制台「服务平台」选错（须 Web 端 JS API）。'
        reportMapError(msg)
        return
      }
      setScriptReady(true)
    }
    script.onerror = () => {
      const msg =
        '地图脚本请求失败（网络、广告拦截、公司代理或 HTTPS 混合内容）。请打开浏览器开发者工具 → Network 查看 webapi.amap.com 是否被拦截。'
      reportMapError(msg)
    }
    document.body.appendChild(script)
    return () => {
      script.onload = null
      script.onerror = null
      script.remove()
    }
  }, [amapKey, amapKeyMissing, amapSecurityCode, pushLog, reportMapError])

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.AMap) return
    let map: AMap.Map
    try {
      map = new window.AMap.Map(containerRef.current, {
        viewMode: '2D',
        zoom: 4,
        center: [110.0, 34.0],
      })
    } catch (e) {
      const msg = `地图初始化异常：${e instanceof Error ? e.message : String(e)}`
      queueMicrotask(() => reportMapError(msg))
      return
    }
    mapRef.current = map
    infoWindowRef.current = new window.AMap.InfoWindow({ offset: new window.AMap.Pixel(0, -30) })
    window.AMap.plugin('AMap.Geocoder', () => {})

    map.on('rightclick', (e: AMap.MapEvent) => {
      const lnglat = e.lnglat
      const lat = lnglat.getLat()
      const lng = lnglat.getLng()
      setPendingMapCoords({ lat, lng })
      pushLog(`已记录经纬度（可填入表单）：${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    })

    const doResize = () => {
      try {
        if (typeof map.resize === 'function') map.resize()
      } catch {
        /* ignore */
      }
    }
    requestAnimationFrame(doResize)
    setTimeout(doResize, 100)
    setTimeout(doResize, 400)

    const el = containerRef.current
    const ro =
      el &&
      typeof ResizeObserver !== 'undefined' &&
      new ResizeObserver(() => {
        doResize()
      })
    if (el && ro) ro.observe(el)

    return () => {
      if (el && ro) ro.disconnect()
      map.destroy()
      mapRef.current = null
    }
  }, [scriptReady, pushLog, setPendingMapCoords, reportMapError])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    drawRoutes(map, mapFocusDayId)
  }, [drawRoutes, mapFocusDayId, cities, spots, dailyPlans, mapRedrawNonce])

  const geocodeCity = useCallback(
    (city: City) => {
      const map = mapRef.current
      if (!map || !window.AMap?.Geocoder) {
        pushLog(`当前环境不支持自动定位城市【${city.name}】的经纬度。`, 'warn')
        return
      }
      const geocoder = new window.AMap.Geocoder({ city: '全国' })
      geocoder.getLocation(
        city.name,
        (status: string, result: { info: string; geocodes: { location: { lng: number; lat: number } }[] }) => {
          if (status === 'complete' && result.info === 'OK' && result.geocodes?.length) {
            const loc = result.geocodes[0].location
            updateCityLocation(city.id, loc.lat, loc.lng)
            pushLog(
              `已根据城市名自动定位：${city.name} -> (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`,
            )
            const m = mapRef.current
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
    const m = mapRef.current
    if (m) drawRoutes(m, useTripStore.getState().mapFocusDayId)
  }, [drawRoutes])

  const api = useMemo<MapApi>(() => ({ geocodeCity, redraw }), [geocodeCity, redraw])

  return (
    <MapContext.Provider value={api}>
      <div className={clsx('flex min-h-0 flex-1 gap-4', className)}>
        <div className="w-[min(340px,34vw)] shrink-0">{sidebar}</div>
        <div className="relative flex min-h-0 min-h-[min(360px,calc(100dvh-12rem))] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-md ring-1 ring-slate-900/[0.04]">
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
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
          <div className="relative flex min-h-0 flex-1 flex-col">
            {mapLoadError && (
              <div className="absolute inset-0 z-[5] flex flex-col justify-center gap-2 overflow-auto bg-amber-50/95 p-4 text-left text-xs leading-relaxed text-amber-950 ring-1 ring-amber-200">
                <p className="font-semibold">地图未就绪</p>
                <p className="whitespace-pre-wrap">{mapLoadError}</p>
                <p className="text-amber-800/90">
                  排查：① 浏览器 F12 → Console / Network 是否有高德报错（如 INVALID_USER_KEY、USERKEY_PLAT_NOMATCH）②
                  控制台 Key 须为「Web 端」，且与 VITE_AMAP_KEY 一致；启用安全密钥时须配置 VITE_AMAP_SECURITY_CODE ③
                  Key 安全设置里放行访问来源（如 localhost、127.0.0.1）④ 修改 client/.env 后必须重启 npm run dev
                </p>
              </div>
            )}
            <div ref={containerRef} className="min-h-0 w-full flex-1" />
            <AiCard />
          </div>
        </div>
      </div>
    </MapContext.Provider>
  )
}
