import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { MapContext, type MapApi } from '../map/MapContext'
import { useTripStore } from '../store'
import type { City } from '../types'
import { useAmapScript } from './map/useAmapScript'
import { MapLegend } from './map/MapLegend'
import { MapErrorOverlay } from './map/MapErrorOverlay'
import { useMapRoutes } from '../hooks/useMapRoutes'

export function MapPanel({
  sidebar,
  className,
}: {
  sidebar?: React.ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMap.Map | null>(null)
  const cityMarkersRef = useRef<AMap.Marker[]>([])
  const spotMarkersRef = useRef<AMap.Marker[]>([])
  const routePolylinesRef = useRef<AMap.Polyline[]>([])
  const distanceLabelsRef = useRef<AMap.Text[]>([])
  const infoWindowRef = useRef<AMap.InfoWindow | null>(null)
  const drawSeqRef = useRef(0)
  const hasInitialFitRef = useRef(false)

  const [legend, setLegend] = useState<
    { key: string; color: string; label: string; dashed?: boolean }[]
  >([])

  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)
  const clearMapFocus = useTripStore((s) => s.clearMapFocus)
  const mapRedrawNonce = useTripStore((s) => s.mapRedrawNonce)
  const setSegmentMode = useTripStore((s) => s.setSegmentMode)
  const updateCityLocation = useTripStore((s) => s.updateCityLocation)
  const setPendingMapCoords = useTripStore((s) => s.setPendingMapCoords)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const pushLog = useTripStore((s) => s.pushLog)

  const reportMapError = useCallback(
    (msg: string) => { pushLog(msg, 'error') },
    [pushLog],
  )

  const { scriptReady, mapLoadError } = useAmapScript(reportMapError)

  const routeRefs = useMemo(() => ({
    routePolylinesRef: routePolylinesRef,
    distanceLabelsRef: distanceLabelsRef,
    cityMarkersRef: cityMarkersRef,
    spotMarkersRef: spotMarkersRef,
    infoWindowRef: infoWindowRef,
    drawSeqRef: drawSeqRef,
    hasInitialFitRef: hasInitialFitRef,
  }), [])

  const { drawRoutes } = useMapRoutes(cities, spots, dailyPlans, mapFocusSpotId, routeRefs, {
    setSegmentMode,
    setSpotDetail,
    setLegend,
  })

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.AMap) return
    let map: AMap.Map
    try {
      map = new window.AMap.Map(containerRef.current, { viewMode: '2D', zoom: 4, center: [110.0, 34.0] })
    } catch (e) {
      queueMicrotask(() => reportMapError(`地图初始化异常：${e instanceof Error ? e.message : String(e)}`))
      return
    }
    mapRef.current = map
    infoWindowRef.current = new window.AMap.InfoWindow({ offset: new window.AMap.Pixel(0, -30) })
    window.AMap.plugin(['AMap.Geocoder', 'AMap.Driving', 'AMap.Walking', 'AMap.Transfer', 'AMap.Riding', 'AMap.AutoComplete', 'AMap.PlaceSearch', 'AMap.Weather'], () => {})

    map.on('rightclick', (e: AMap.MapEvent) => {
      const lat = e.lnglat.getLat(); const lng = e.lnglat.getLng()
      setPendingMapCoords({ lat, lng })
      pushLog(`已记录经纬度(可填入表单):${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      const AMapNs = window.AMap
      if (AMapNs?.Geocoder) {
        try {
          const g = new AMapNs.Geocoder({ radius: 200, extensions: 'all' })
          g.getAddress([lng, lat], (status, result) => {
            if (status !== 'complete' || result.info !== 'OK' || !result.regeocode) return
            const re = result.regeocode
            const suggestedName = re.pois?.[0]?.name || re.addressComponent?.building?.name || re.addressComponent?.neighborhood?.name || null
            const address = re.formatted_address || null
            if (suggestedName || address) { useTripStore.getState().setPendingMapSuggestion(suggestedName, address); pushLog(`反向地理:${suggestedName ?? '(无名)'}${address ? ` · ${address}` : ''}`) }
          })
        } catch { /* ignore */ }
      }
    })

    const doResize = () => { try { if (typeof map.resize === 'function') map.resize() } catch { /* ignore */ } }
    requestAnimationFrame(doResize); setTimeout(doResize, 100); setTimeout(doResize, 400)
    const el = containerRef.current
    const ro = el && typeof ResizeObserver !== 'undefined' && new ResizeObserver(() => { doResize() })
    if (el && ro) ro.observe(el)
    return () => { if (el && ro) ro.disconnect(); map.destroy(); mapRef.current = null }
  }, [scriptReady, pushLog, setPendingMapCoords, reportMapError])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    drawRoutes(map, mapFocusDayId)
  }, [drawRoutes, mapFocusDayId, cities, spots, dailyPlans, mapRedrawNonce])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocusSpotId) return
    const spot = useTripStore.getState().spots.find((s) => s.id === mapFocusSpotId)
    if (!spot) return
    try { requestAnimationFrame(() => { map.panTo([spot.location.lng, spot.location.lat]); map.setZoom(13) }) } catch { /* ignore */ }
  }, [mapFocusSpotId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocusDayId) return
    const state = useTripStore.getState()
    const day = state.dailyPlans.find((d) => d.id === mapFocusDayId)
    if (!day || !day.spotOrder.length) return
    const dayMarkers = spotMarkersRef.current.filter((_, i) => { const spotId = state.spots[i]?.id; return spotId ? day.spotOrder.includes(spotId) : false })
    if (dayMarkers.length) { try { map.setFitView(dayMarkers) } catch { /* ignore */ } }
  }, [mapFocusDayId])

  const geocodeCity = useCallback(
    (city: City) => {
      const map = mapRef.current
      if (!map || !window.AMap?.Geocoder) { pushLog(`当前环境不支持自动定位城市【${city.name}】的经纬度。`, 'warn'); return }
      const geocoder = new window.AMap.Geocoder({ city: '全国' })
      geocoder.getLocation(city.name, (status: string, result: { info: string; geocodes: { location: { lng: number; lat: number } }[] }) => {
        if (status === 'complete' && result.info === 'OK' && result.geocodes?.length) {
          const loc = result.geocodes[0].location
          updateCityLocation(city.id, loc.lat, loc.lng)
          pushLog(`已根据城市名自动定位：${city.name} -> (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`)
          const m = mapRef.current; if (m) drawRoutes(m, useTripStore.getState().mapFocusDayId)
        } else { pushLog(`无法根据城市名自动获取经纬度：${city.name}，请手动填写。`, 'warn') }
      })
    },
    [drawRoutes, pushLog, updateCityLocation],
  )

  const redraw = useCallback(() => { const m = mapRef.current; if (m) drawRoutes(m, useTripStore.getState().mapFocusDayId) }, [drawRoutes])
  const api = useMemo<MapApi>(() => ({ geocodeCity, redraw }), [geocodeCity, redraw])

  const handleResetView = useCallback(() => {
    clearMapFocus()
    const map = mapRef.current
    const AMapNs = window.AMap
    if (map && AMapNs) {
      const overlays: AMap.Overlay[] = [...cityMarkersRef.current, ...spotMarkersRef.current, ...routePolylinesRef.current]
      if (overlays.length) { try { map.setFitView(overlays) } catch { /* ignore */ } }
    }
  }, [clearMapFocus])

  const showResetButton = !!(mapFocusSpotId || mapFocusDayId)

  const [mapHeight, setMapHeight] = useState<number | null>(null)
  const [mapWidth, setMapWidth] = useState<number | null>(null)
  const [mapPosition, setMapPosition] = useState<{ x: number; y: number } | null>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.amap-container') || target.closest('button')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const el = resizeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const parentRect = el.parentElement?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const origX = rect.left - parentRect.left
    const origY = rect.top - parentRect.top
    const onMove = (ev: MouseEvent) => {
      setMapPosition({ x: origX + (ev.clientX - startX), y: origY + (ev.clientY - startY) })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startHeight = resizeRef.current?.offsetHeight ?? 600
    const startWidth = resizeRef.current?.offsetWidth ?? 800
    const onMove = (ev: MouseEvent) => {
      setMapHeight(Math.max(200, startHeight + (ev.clientY - startY)))
      setMapWidth(Math.max(300, startWidth + (ev.clientX - startX)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <MapContext.Provider value={api}>
      <div className={clsx('flex min-h-0 flex-1 gap-4', className)}>
        {sidebar && <div className="w-[min(380px,38vw)] shrink-0">{sidebar}</div>}
        <div
          ref={resizeRef}
          onMouseDown={handleDragStart}
          className="group relative flex min-h-[200px] cursor-move flex-col overflow-hidden rounded-xl border-[6px] border-[#ddd0b4] bg-[#f8f2e4] shadow-lg"
          style={{
            height: mapHeight ?? 'calc(100% - 80px)',
            width: mapWidth ?? '100%',
            left: mapPosition?.x ?? 0,
            top: mapPosition?.y ?? 0,
          }}
        >
          <MapLegend items={legend} onResetView={showResetButton ? handleResetView : undefined} />
          <div className="relative flex flex-1 flex-col">
            {mapLoadError && <MapErrorOverlay error={mapLoadError} />}
            <div ref={containerRef} className="min-h-0 w-full flex-1" />
          </div>
          <div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-se-resize items-end justify-end rounded-br-lg p-0.5 opacity-0 transition group-hover:opacity-100"
          >
            <div className="h-3 w-3 rounded-br border-b-2 border-r-2 border-slate-400" />
          </div>
        </div>
      </div>
    </MapContext.Provider>
  )
}
