import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { MapContext, type MapApi } from '../map/MapContext'
import { distanceInMeters } from '../lib/geo'
import {
  SPOT_KIND_COLOR,
  SPOT_KIND_ICON,
  SPOT_KIND_LABEL,
} from '../lib/spotKind'
import {
  fetchAllModes,
  fetchSegment,
  TRANSPORT_ICON,
  TRANSPORT_LABEL,
} from '../lib/amapRouting'
import { useTripStore } from '../store/tripStore'
import type { City, Spot, TransportMode } from '../types'
import { useAmapScript } from './map/useAmapScript'
import { MapLegend } from './map/MapLegend'
import { MapErrorOverlay } from './map/MapErrorOverlay'

const DAY_COLORS = [
  '#059669', '#2563eb', '#7c3aed', '#c026d3',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
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

  // ---- drawRoutes: routes, markers, legend ----
  const drawRoutes = useCallback(
    (map: AMap.Map, focusDayId: string | null) => {
      drawSeqRef.current += 1
      const mySeq = drawSeqRef.current

      const showSegmentPopup = (
        dayId: string, fromId: string, toId: string,
        a: { lat: number; lng: number }, b: { lat: number; lng: number },
        currentMode: TransportMode, cityName: string | undefined,
      ) => {
        const AMapNs = window.AMap
        if (!AMapNs) return
        const wrap = document.createElement('div')
        wrap.style.minWidth = '200px'
        wrap.style.fontSize = '12px'
        const title = document.createElement('div')
        title.style.fontWeight = '600'
        title.style.marginBottom = '6px'
        const fromName = spots.find((s) => s.id === fromId)?.name ?? '起点'
        const toName = spots.find((s) => s.id === toId)?.name ?? '终点'
        title.textContent = `${fromName} → ${toName}`
        wrap.appendChild(title)
        const list = document.createElement('div')
        list.style.display = 'grid'
        list.style.gap = '4px'
        const placeholder = document.createElement('div')
        placeholder.style.color = '#94a3b8'
        placeholder.style.fontSize = '11px'
        placeholder.textContent = '加载 4 种交通方式…'
        list.appendChild(placeholder)
        wrap.appendChild(list)
        const hint = document.createElement('div')
        hint.style.marginTop = '6px'
        hint.style.fontSize = '10px'
        hint.style.color = '#94a3b8'
        hint.textContent = '点击切换 · 右键线条也可快速切换'
        wrap.appendChild(hint)
        const iw = new AMapNs.InfoWindow({ offset: new AMapNs.Pixel(0, -8) })
        iw.setContent(wrap)
        const midLng = (a.lng + b.lng) / 2
        const midLat = (a.lat + b.lat) / 2
        iw.open(map, new AMapNs.LngLat(midLng, midLat))
        fetchAllModes(a, b, { city: cityName }).then((all) => {
          list.innerHTML = ''
          ;(['driving', 'walking', 'transit', 'riding'] as TransportMode[]).forEach((m) => {
            const row = document.createElement('button')
            row.type = 'button'
            row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#334155;'
            if (m === currentMode) { row.style.background = '#ecfeff'; row.style.borderColor = '#22d3ee'; row.style.fontWeight = '600' }
            const r = all[m]
            const summary = r ? `${(r.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(r.duration / 60))} 分钟` : '不可达'
            row.innerHTML = `<span style="width:1.2em;text-align:center">${TRANSPORT_ICON[m]}</span><span style="flex:1">${TRANSPORT_LABEL[m]}</span><span style="color:${r ? '#0f766e' : '#94a3b8'};font-variant-numeric:tabular-nums;">${summary}</span>`
            row.addEventListener('click', () => { setSegmentMode(dayId, fromId, toId, m); iw.open(map, new AMapNs.LngLat(midLng, midLat)) })
            list.appendChild(row)
          })
        })
      }

      const showSegmentMenu = (
        dayId: string, fromId: string, toId: string,
        currentMode: TransportMode, _cityName: string | undefined,
        pixel?: { x: number; y: number },
      ) => {
        const AMapNs = window.AMap
        if (!AMapNs) return
        const a = spots.find((s) => s.id === fromId)?.location
        const b = spots.find((s) => s.id === toId)?.location
        if (!a || !b) return
        const wrap = document.createElement('div')
        wrap.style.cssText = 'position:absolute;z-index:1200;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15),0 0 0 1px rgba(0,0,0,0.05);padding:8px 12px;font-size:12px;min-width:140px;'
        const title = document.createElement('div')
        title.style.fontWeight = '600'; title.style.marginBottom = '4px'; title.style.color = '#334155'; title.textContent = '选择交通方式'
        wrap.appendChild(title)
        const close = () => { wrap.remove(); document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape) }
        const onOutside = (ev: MouseEvent) => { if (!wrap.contains(ev.target as Node)) close() }
        const onEscape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close() }
        ;(['driving', 'walking', 'transit', 'riding'] as TransportMode[]).forEach((m) => {
          const row = document.createElement('button')
          row.type = 'button'
          row.style.cssText = 'display:block;width:100%;padding:4px 8px;margin-top:2px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#334155;'
          if (m === currentMode) { row.style.background = '#ecfeff'; row.style.borderColor = '#22d3ee'; row.style.fontWeight = '600' }
          row.textContent = `${TRANSPORT_ICON[m]} ${TRANSPORT_LABEL[m]}${m === currentMode ? ' ✓' : ''}`
          row.addEventListener('click', () => { setSegmentMode(dayId, fromId, toId, m); close() })
          wrap.appendChild(row)
        })
        const container = map.getContainer()
        if (pixel) { wrap.style.left = pixel.x + 'px'; wrap.style.top = pixel.y + 'px' }
        else {
          const midLng = (a.lng + b.lng) / 2; const midLat = (a.lat + b.lat) / 2
          const midPixel = (map as unknown as Record<string, unknown>).lnglatToPixel as ((lnglat: [number, number]) => { x: number; y: number }) | undefined
          if (midPixel) { const p = midPixel([midLng, midLat]); wrap.style.left = p.x + 'px'; wrap.style.top = p.y + 'px' }
        }
        container.appendChild(wrap)
        setTimeout(() => { document.addEventListener('mousedown', onOutside); document.addEventListener('keydown', onEscape) }, 0)
      }

      // Clear previous overlays
      routePolylinesRef.current.forEach((p) => p.setMap(null)); routePolylinesRef.current = []
      distanceLabelsRef.current.forEach((t) => t.setMap(null)); distanceLabelsRef.current = []
      const leg: { key: string; color: string; label: string; dashed?: boolean }[] = []

      if (!cities.length && !dailyPlans.length) { setLegend([]); return }

      const AMap = window.AMap
      const sortedCities = cities.slice().sort((a, b) => a.order - b.order)
      const cityPath = sortedCities.filter((c) => c.location).map((c) => [c.location!.lng, c.location!.lat])
      if (cityPath.length >= 2) {
        const line = new AMap.Polyline({ path: cityPath, strokeColor: '#64748b', strokeWeight: 4, strokeStyle: 'dashed' })
        map.add(line); routePolylinesRef.current.push(line)
        leg.push({ key: 'city', color: '#64748b', label: '城市间移动', dashed: true })
      }

      const daysToDraw = focusDayId
        ? dailyPlans.filter((d) => d.id === focusDayId)
        : dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex)

      daysToDraw.forEach((day, idx) => {
        const coords: number[][] = []
        const orderedSpots: Spot[] = []
        day.spotOrder.forEach((sid) => { const spot = spots.find((s) => s.id === sid); if (spot?.location) { coords.push([spot.location.lng, spot.location.lat]); orderedSpots.push(spot) } })
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        const cityName = cities.find((c) => c.id === day.cityId)?.name
        if (coords.length >= 2) {
          const fallback = new AMap.Polyline({ path: coords, strokeColor: color, strokeWeight: 2, strokeOpacity: 0.35, strokeStyle: 'dashed' })
          map.add(fallback); routePolylinesRef.current.push(fallback)
          for (let i = 0; i < orderedSpots.length - 1; i++) {
            const a = orderedSpots[i].location; const b = orderedSpots[i + 1].location
            const fromId = orderedSpots[i].id; const toId = orderedSpots[i + 1].id
            const segKey = `${fromId}|${toId}`
            const mode: TransportMode = day.segmentModes?.[segKey] ?? 'driving'
            fetchSegment(mode, a, b, { city: cityName })
              .then((seg) => {
                if (drawSeqRef.current !== mySeq) return
                const line = new AMap.Polyline({ path: seg.path, strokeColor: color, strokeWeight: 5, strokeOpacity: 0.9, strokeStyle: mode === 'driving' ? 'solid' : 'dashed' })
                map.add(line); routePolylinesRef.current.push(line)
                line.on('click', () => showSegmentPopup(day.id, fromId, toId, a, b, mode, cityName))
                line.on('rightclick', (e: AMap.MapEvent & { pixel?: { x: number; y: number } }) => showSegmentMenu(day.id, fromId, toId, mode, cityName, e.pixel))
                const midIdx = Math.floor(seg.path.length / 2); const midPoint = seg.path[midIdx]
                const mid: [number, number] = midPoint && midPoint.length >= 2 ? [midPoint[0], midPoint[1]] : [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2]
                const km = (seg.distance / 1000).toFixed(1); const min = Math.max(1, Math.round(seg.duration / 60))
                const label = new AMap.Text({ text: `${TRANSPORT_ICON[mode]} ${km} km · ${min} 分钟`, position: mid, style: { 'background-color': 'rgba(255,255,255,0.95)', 'border-radius': '4px', padding: '2px 6px', 'font-size': '10px', border: `1px solid ${color}`, color, cursor: 'pointer' } })
                map.add(label); distanceLabelsRef.current.push(label)
              })
              .catch(() => {
                if (drawSeqRef.current !== mySeq) return
                const line = new AMap.Polyline({ path: [[a.lng, a.lat], [b.lng, b.lat]], strokeColor: color, strokeWeight: 4, strokeOpacity: 0.7, strokeStyle: 'dashed' })
                map.add(line); routePolylinesRef.current.push(line)
                line.on('click', () => showSegmentPopup(day.id, fromId, toId, a, b, mode, cityName))
                line.on('rightclick', (e: AMap.MapEvent & { pixel?: { x: number; y: number } }) => showSegmentMenu(day.id, fromId, toId, mode, cityName, e.pixel))
                const d = distanceInMeters(a.lat, a.lng, b.lat, b.lng)
                const label = new AMap.Text({ text: `${TRANSPORT_ICON[mode]} ${(d / 1000).toFixed(1)} km (直线)`, position: [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2], style: { 'background-color': 'rgba(255,255,255,0.9)', 'border-radius': '4px', padding: '2px 4px', 'font-size': '10px', border: `1px solid ${color}`, color } })
                map.add(label); distanceLabelsRef.current.push(label)
              })
          }
        }
        if (coords.length >= 1) { const city = cities.find((c) => c.id === day.cityId); leg.push({ key: day.id, color, label: `第${day.dayIndex}天${city ? ` · ${city.name}` : ''}` }) }
      })

      setLegend(leg)

      // City markers
      cityMarkersRef.current.forEach((m) => m.setMap(null)); cityMarkersRef.current = []
      sortedCities.forEach((city) => {
        if (!city.location) return
        const marker = new AMap.Marker({ position: [city.location.lng, city.location.lat], title: city.name, map })
        marker.on('click', () => { const content = document.createElement('div'); content.textContent = `城市：${city.name}`; infoWindowRef.current?.setContent(content); infoWindowRef.current?.open(map, marker.getPosition()) })
        cityMarkersRef.current.push(marker)
      })

      // Spot markers
      spotMarkersRef.current.forEach((m) => m.setMap(null)); spotMarkersRef.current = []
      const assignedSpotIds = new Set<string>()
      const spotColorById = new Map<string, string>()
      daysToDraw.forEach((day, idx) => { const color = DAY_COLORS[idx % DAY_COLORS.length]; day.spotOrder.forEach((sid) => { assignedSpotIds.add(sid); spotColorById.set(sid, color) }) })

      spots.forEach((spot) => {
        const isPool = !assignedSpotIds.has(spot.id)
        const dayColor = spotColorById.get(spot.id)
        const isFocused = spot.id === mapFocusSpotId
        const labelBg = spot.kind === 'hotel' ? SPOT_KIND_COLOR.hotel : spot.kind === 'restaurant' ? SPOT_KIND_COLOR.restaurant : dayColor ?? SPOT_KIND_COLOR.sight
        const labelShadow = isFocused ? '0 0 0 2px #fff, 0 0 0 5px rgba(13,148,136,0.75), 0 4px 14px rgba(13,148,136,0.45)' : '0 1px 3px rgba(0,0,0,0.25)'
        const icon = SPOT_KIND_ICON[spot.kind]
        const marker = new AMap.Marker({
          position: [spot.location.lng, spot.location.lat], title: spot.name, map,
          zIndex: isFocused ? 200 : isPool ? 50 : 100,
          label: { content: `<span style="display:inline-block;padding:1px 6px;border-radius:9999px;background:${labelBg};color:#fff;font-size:10px;font-weight:600;box-shadow:${labelShadow}">${icon} ${spot.name}</span>`, direction: 'top' },
        })
        marker.on('click', () => {
          const content = document.createElement('div'); content.className = 'amap-info-content'
          const nameDiv = document.createElement('div'); nameDiv.style.fontWeight = '600'; nameDiv.style.marginBottom = '4px'
          nameDiv.textContent = `${icon} ${SPOT_KIND_LABEL[spot.kind]}${isPool ? '(池)' : ''}: ${spot.name}`; content.appendChild(nameDiv)
          if (spot.kind === 'sight' && spot.visitTimeText) { const t = document.createElement('div'); t.style.fontSize = '11px'; t.style.color = '#475569'; t.textContent = `时间:${spot.visitTimeText}`; content.appendChild(t) }
          if (spot.kind === 'hotel' && spot.price) { const t = document.createElement('div'); t.style.fontSize = '11px'; t.style.color = '#475569'; t.textContent = `价格:${spot.price}`; content.appendChild(t) }
          if (spot.innerTransport) { const t = document.createElement('div'); t.style.fontSize = '11px'; t.style.color = '#475569'; t.textContent = `交通:${spot.innerTransport}`; content.appendChild(t) }
          if (spot.kind === 'sight' && spot.guideUrl) { const a = document.createElement('a'); a.href = spot.guideUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '攻略链接'; a.style.color = '#0d9488'; a.style.textDecoration = 'underline'; const wrap = document.createElement('div'); wrap.style.marginTop = '4px'; wrap.style.fontSize = '11px'; wrap.appendChild(a); content.appendChild(wrap) }
          if (spot.kind === 'restaurant' && spot.link) { const a = document.createElement('a'); a.href = spot.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '查看链接'; a.style.color = '#0d9488'; a.style.textDecoration = 'underline'; const wrap = document.createElement('div'); wrap.style.marginTop = '4px'; wrap.style.fontSize = '11px'; wrap.appendChild(a); content.appendChild(wrap) }
          const actionRow = document.createElement('div'); actionRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0'
          const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = '✏️ 编辑'; editBtn.style.cssText = 'padding:3px 10px;border-radius:6px;border:1px solid #14b8a6;background:#14b8a6;color:#fff;font-size:11px;font-weight:600;cursor:pointer;'
          editBtn.addEventListener('click', () => { setSpotDetail(spot) }); actionRow.appendChild(editBtn); content.appendChild(actionRow)
          infoWindowRef.current?.setContent(content); infoWindowRef.current?.open(map, marker.getPosition())
        })
        spotMarkersRef.current.push(marker)
      })

      if (!hasInitialFitRef.current) {
        const overlays: AMap.Overlay[] = [...cityMarkersRef.current, ...spotMarkersRef.current, ...routePolylinesRef.current]
        if (overlays.length) { map.setFitView(overlays); hasInitialFitRef.current = true }
      }
    },
    [cities, spots, dailyPlans, mapFocusSpotId, setSegmentMode, setSpotDetail],
  )

  // ---- Map init effect ----
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

  // ---- Route drawing effect ----
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    drawRoutes(map, mapFocusDayId)
  }, [drawRoutes, mapFocusDayId, cities, spots, dailyPlans, mapRedrawNonce])

  // ---- Focus spot pan ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocusSpotId) return
    const spot = useTripStore.getState().spots.find((s) => s.id === mapFocusSpotId)
    if (!spot) return
    try { requestAnimationFrame(() => { map.panTo([spot.location.lng, spot.location.lat]); map.setZoom(13) }) } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFocusSpotId])

  // ---- Focus day fit ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocusDayId) return
    const state = useTripStore.getState()
    const day = state.dailyPlans.find((d) => d.id === mapFocusDayId)
    if (!day || !day.spotOrder.length) return
    const dayMarkers = spotMarkersRef.current.filter((_, i) => { const spotId = state.spots[i]?.id; return spotId ? day.spotOrder.includes(spotId) : false })
    if (dayMarkers.length) { try { map.setFitView(dayMarkers) } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFocusDayId])

  // ---- Geocode city ----
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

  return (
    <MapContext.Provider value={api}>
      <div className={clsx('flex min-h-0 flex-1 gap-4', className)}>
        <div className="w-[min(380px,38vw)] shrink-0">{sidebar}</div>
        <div className="warm-card shadow-stone-lg relative flex min-h-0 min-h-[min(360px,calc(100dvh-12rem))] flex-1 flex-col overflow-hidden border-[6px] border-[#ddd0b4] bg-[#f8f2e4]">
          <MapLegend items={legend} onResetView={showResetButton ? handleResetView : undefined} />
          <div className="relative flex min-h-0 flex-1 flex-col">
            {mapLoadError && <MapErrorOverlay error={mapLoadError} />}
            <div ref={containerRef} className="min-h-0 w-full flex-1" />
          </div>
        </div>
      </div>
    </MapContext.Provider>
  )
}
