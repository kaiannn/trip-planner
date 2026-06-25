import { useCallback } from 'react'
import { distanceInMeters } from '../lib/geo'
import {
  DAY_COLORS,
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
import type { City, DailyPlan, Spot, TransportMode } from '../types'

export interface MapRouteRefs {
  routePolylinesRef: React.MutableRefObject<AMap.Polyline[]>
  distanceLabelsRef: React.MutableRefObject<AMap.Text[]>
  cityMarkersRef: React.MutableRefObject<AMap.Marker[]>
  spotMarkersRef: React.MutableRefObject<AMap.Marker[]>
  infoWindowRef: React.MutableRefObject<AMap.InfoWindow | null>
  drawSeqRef: React.MutableRefObject<number>
  hasInitialFitRef: React.MutableRefObject<boolean>
}

export interface MapRouteCallbacks {
  setSegmentMode: (dayId: string, fromId: string, toId: string, mode: TransportMode) => void
  setSpotDetail: (spot: Spot | null) => void
  setLegend: (items: { key: string; color: string; label: string; dashed?: boolean }[]) => void
}

export function useMapRoutes(
  cities: City[],
  spots: Spot[],
  dailyPlans: DailyPlan[],
  mapFocusSpotId: string | null,
  refs: MapRouteRefs,
  callbacks: MapRouteCallbacks,
) {
  const { setSegmentMode, setSpotDetail, setLegend } = callbacks
  const {
    routePolylinesRef, distanceLabelsRef, cityMarkersRef, spotMarkersRef,
    infoWindowRef, drawSeqRef, hasInitialFitRef,
  } = refs

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
        const titleEl = document.createElement('div')
        titleEl.style.fontWeight = '600'; titleEl.style.marginBottom = '4px'; titleEl.style.color = '#334155'; titleEl.textContent = '选择交通方式'
        wrap.appendChild(titleEl)
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

      cityMarkersRef.current.forEach((m) => m.setMap(null)); cityMarkersRef.current = []
      sortedCities.forEach((city) => {
        if (!city.location) return
        const marker = new AMap.Marker({ position: [city.location.lng, city.location.lat], title: city.name, map })
        marker.on('click', () => { const content = document.createElement('div'); content.textContent = `城市：${city.name}`; infoWindowRef.current?.setContent(content); infoWindowRef.current?.open(map, marker.getPosition()) })
        cityMarkersRef.current.push(marker)
      })

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
    [cities, spots, dailyPlans, mapFocusSpotId, setSegmentMode, setSpotDetail, setLegend, routePolylinesRef, distanceLabelsRef, cityMarkersRef, spotMarkersRef, infoWindowRef, drawSeqRef, hasInitialFitRef],
  )

  return { drawRoutes }
}
