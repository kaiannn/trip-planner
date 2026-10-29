import { useCallback, useRef } from 'react'
import { distanceInMeters } from '../lib/geo'
import { resolveDaySpotOrder, inactiveBranchSpotIds, allPlannedSpotIds, branchGhostLegs } from '../lib/resolveDayPath'
import {
  DAY_COLORS,
  SPOT_KIND_COLOR,
  SPOT_KIND_LABEL,
} from '../lib/spotKind'
import {
  injectMapMarkerStyles,
  spotMarkerHtml,
  cityMarkerHtml,
  routeLabelTextStyle,
  truncateMapLabel,
} from '../lib/mapMarker'
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

  const openSegmentInfoRef = useRef<AMap.InfoWindow | null>(null)
  const openSegmentKeyRef = useRef<string | null>(null)

  const closeSegmentPopup = useCallback(() => {
    openSegmentInfoRef.current?.close()
    openSegmentInfoRef.current = null
    openSegmentKeyRef.current = null
  }, [])

  const drawRoutes = useCallback(
    (map: AMap.Map, focusDayId: string | null) => {
      drawSeqRef.current += 1
      const mySeq = drawSeqRef.current
      closeSegmentPopup()

      const showSegmentPopup = (
        dayId: string, fromId: string, toId: string,
        a: { lat: number; lng: number }, b: { lat: number; lng: number },
        currentMode: TransportMode, cityName: string | undefined,
      ) => {
        const AMapNs = window.AMap
        if (!AMapNs) return
        const segKey = `${dayId}|${fromId}|${toId}`
        if (openSegmentKeyRef.current === segKey) {
          closeSegmentPopup()
          return
        }
        closeSegmentPopup()
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
        hint.textContent = '点击切换 · 再点线条关闭'
        wrap.appendChild(hint)
        const iw = new AMapNs.InfoWindow({ offset: new AMapNs.Pixel(0, -8) })
        iw.setContent(wrap)
        const midLng = (a.lng + b.lng) / 2
        const midLat = (a.lat + b.lat) / 2
        const midPos = new AMapNs.LngLat(midLng, midLat)
        iw.open(map, midPos)
        openSegmentInfoRef.current = iw
        openSegmentKeyRef.current = segKey
        iw.on('close', () => {
          if (openSegmentInfoRef.current === iw) {
            openSegmentInfoRef.current = null
            openSegmentKeyRef.current = null
          }
        })
        fetchAllModes(a, b, { city: cityName }).then((all) => {
          if (openSegmentInfoRef.current !== iw) return
          list.innerHTML = ''
          ;(['driving', 'walking', 'transit'] as TransportMode[]).forEach((m) => {
            const row = document.createElement('button')
            row.type = 'button'
            row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#334155;'
            if (m === currentMode) { row.style.background = '#ecfeff'; row.style.borderColor = '#22d3ee'; row.style.fontWeight = '600' }
            const r = all[m]
            const stats = r
              ? `${r.estimated ? '约 ' : ''}${(r.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(r.duration / 60))} 分钟${r.estimated ? '（估）' : ''}`
              : '不可达'
            const detail = r?.summary
              ? `<div style="margin-top:2px;font-size:10px;color:#64748b;line-height:1.35;">${r.summary}</div>`
              : ''
            row.style.flexDirection = 'column'
            row.style.alignItems = 'stretch'
            row.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><span style="width:1.2em;text-align:center">${TRANSPORT_ICON[m]}</span><span style="flex:1">${TRANSPORT_LABEL[m]}</span><span style="color:${r ? '#0f766e' : '#94a3b8'};font-variant-numeric:tabular-nums;">${stats}</span></div>${detail}`
            row.addEventListener('click', () => {
              if (openSegmentInfoRef.current === iw) closeSegmentPopup()
              setSegmentMode(dayId, fromId, toId, m)
            })
            list.appendChild(row)
          })
        })
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
        const activeOrder = resolveDaySpotOrder(day)
        activeOrder.forEach((sid) => { const spot = spots.find((s) => s.id === sid); if (spot?.location) { coords.push([spot.location.lng, spot.location.lat]); orderedSpots.push(spot) } })
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        const cityName = cities.find((c) => c.id === day.cityId)?.name
        if (coords.length >= 2) {
          for (let i = 0; i < orderedSpots.length - 1; i++) {
            const a = orderedSpots[i].location; const b = orderedSpots[i + 1].location
            const fromId = orderedSpots[i].id; const toId = orderedSpots[i + 1].id
            const segKey = `${fromId}|${toId}`
            // segmentModes are keyed by primary ids; remap when an alt swapped in
            const primA = day.spotOrder[i]
            const primB = day.spotOrder[i + 1]
            const rawMode = day.segmentModes?.[segKey]
              ?? day.segmentModes?.[`${primA}|${primB}`]
              ?? 'driving'
            // Legacy trips may still store 'riding' — treat as driving
            const mode: TransportMode = (rawMode as string) === 'riding' ? 'driving' : rawMode
            fetchSegment(mode, a, b, { city: cityName })
              .then((seg) => {
                if (drawSeqRef.current !== mySeq) return
                const line = new AMap.Polyline({ path: seg.path, strokeColor: color, strokeWeight: 5, strokeOpacity: 0.9, strokeStyle: mode === 'driving' ? 'solid' : 'dashed' })
                map.add(line); routePolylinesRef.current.push(line)
                line.on('click', () => showSegmentPopup(day.id, fromId, toId, a, b, mode, cityName))
                const midIdx = Math.floor(seg.path.length / 2); const midPoint = seg.path[midIdx]
                const mid: [number, number] = midPoint && midPoint.length >= 2 ? [midPoint[0], midPoint[1]] : [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2]
                const km = (seg.distance / 1000).toFixed(1); const min = Math.max(1, Math.round(seg.duration / 60))
                const label = new AMap.Text({ text: `${TRANSPORT_ICON[mode]} ${seg.estimated ? '约 ' : ''}${km} km · ${min} 分钟`, position: mid, style: routeLabelTextStyle(color) })
                map.add(label); distanceLabelsRef.current.push(label)
              })
              .catch(() => {
                if (drawSeqRef.current !== mySeq) return
                const line = new AMap.Polyline({ path: [[a.lng, a.lat], [b.lng, b.lat]], strokeColor: color, strokeWeight: 4, strokeOpacity: 0.7, strokeStyle: 'dashed' })
                map.add(line); routePolylinesRef.current.push(line)
                line.on('click', () => showSegmentPopup(day.id, fromId, toId, a, b, mode, cityName))
                const d = distanceInMeters(a.lat, a.lng, b.lat, b.lng)
                const label = new AMap.Text({ text: `${TRANSPORT_ICON[mode]} ${(d / 1000).toFixed(1)} km (直线)`, position: [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2], style: routeLabelTextStyle(color) })
                map.add(label); distanceLabelsRef.current.push(label)
              })
          }
        }
        // Ghost legs for non-active branches (decision tree branches)
        if (focusDayId === day.id && day.dayBranches?.length) {
          const locMap = new Map<string, { lat: number; lng: number }>()
          spots.forEach((sp) => locMap.set(sp.id, sp.location))
          branchGhostLegs(day, locMap).forEach(({ from, to }) => {
            const line = new AMap.Polyline({
              path: [[from.lng, from.lat], [to.lng, to.lat]],
              strokeColor: color,
              strokeWeight: 2,
              strokeOpacity: 0.4,
              strokeStyle: 'dashed',
            })
            map.add(line); routePolylinesRef.current.push(line)
          })
        }
        if (coords.length >= 1) {
          const city = cities.find((c) => c.id === day.cityId)
          const nBr = day.dayBranches?.length ?? 0
          leg.push({
            key: day.id,
            color,
            label: `第${day.dayIndex}天${city ? ` · ${city.name}` : ''}${nBr ? ` · ${nBr}个状况` : ''}`,
          })
        }
      })
      if (dailyPlans.some((d) => d.dayBranches?.length)) {
        leg.push({ key: 'branch', color: '#94a3b8', label: '状况分支', dashed: true })
      }

      setLegend(leg)

      injectMapMarkerStyles()

      cityMarkersRef.current.forEach((m) => m.setMap(null)); cityMarkersRef.current = []
      sortedCities.forEach((city) => {
        if (!city.location) return
        const marker = new AMap.Marker({
          position: [city.location.lng, city.location.lat],
          title: city.name,
          map,
          content: cityMarkerHtml(city.name),
          offset: new AMap.Pixel(0, 0),
        })
        marker.on('click', () => { const content = document.createElement('div'); content.textContent = `城市：${city.name}`; infoWindowRef.current?.setContent(content); infoWindowRef.current?.open(map, marker.getPosition()) })
        cityMarkersRef.current.push(marker)
      })

      spotMarkersRef.current.forEach((m) => m.setMap(null)); spotMarkersRef.current = []
      const assignedSpotIds = new Set<string>()
      const spotColorById = new Map<string, string>()
      const altOnlyIds = new Set<string>()
      /** Focused day: spot id → visit order (1-based) for pin glyphs. */
      const orderOnFocusDay = new Map<string, number>()
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 0
      const denseSpots = spots.length > 18
      daysToDraw.forEach((day, idx) => {
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        allPlannedSpotIds(day).forEach((sid) => {
          assignedSpotIds.add(sid)
          if (!spotColorById.has(sid)) spotColorById.set(sid, color)
        })
        inactiveBranchSpotIds(day).forEach((sid) => altOnlyIds.add(sid))
        if (focusDayId === day.id) {
          resolveDaySpotOrder(day).forEach((sid, i) => {
            if (!orderOnFocusDay.has(sid)) orderOnFocusDay.set(sid, i + 1)
          })
        }
      })

      spots.forEach((spot) => {
        const isPool = !assignedSpotIds.has(spot.id)
        const isAltGhost = altOnlyIds.has(spot.id)
        const dayColor = spotColorById.get(spot.id)
        const isFocused = spot.id === mapFocusSpotId
        const isKindPin = spot.kind === 'hotel' || spot.kind === 'restaurant'
        const fill = isKindPin
          ? SPOT_KIND_COLOR[spot.kind]
          : dayColor ?? SPOT_KIND_COLOR.sight
        const order = orderOnFocusDay.get(spot.id)
        const pinGlyph = isKindPin
          ? (spot.kind === 'hotel' ? '宿' : '食')
          : order != null
            ? String(order)
            : '·'

        const onFocusDay = order != null
        const showLabel =
          isFocused
          || onFocusDay
          || (isKindPin && !isPool && !isAltGhost)
          || (!isPool && !isAltGhost && !denseSpots && !focusDayId && zoom >= 12)
        const label = showLabel
          ? truncateMapLabel(`${spot.name}${isAltGhost ? ' ·备选' : isPool ? ' ·池' : ''}`)
          : null

        const marker = new AMap.Marker({
          position: [spot.location.lng, spot.location.lat],
          title: spot.name,
          map,
          content: spotMarkerHtml({
            fill,
            glyph: pinGlyph,
            label,
            focused: isFocused,
            ghost: isAltGhost,
            pool: isPool || isAltGhost,
          }),
          offset: new AMap.Pixel(0, 0),
          zIndex: isFocused ? 200 : isAltGhost || isPool ? 50 : 100,
        })
        marker.on('click', () => {
          const content = document.createElement('div'); content.className = 'amap-info-content'
          const nameDiv = document.createElement('div'); nameDiv.style.fontWeight = '600'; nameDiv.style.marginBottom = '4px'
          nameDiv.textContent = `${SPOT_KIND_LABEL[spot.kind]}${isPool ? '(池)' : ''}: ${spot.name}`; content.appendChild(nameDiv)
          if (spot.kind === 'sight' && spot.visitTimeText) { const t = document.createElement('div'); t.style.fontSize = '11px'; t.style.color = '#475569'; t.textContent = `时间:${spot.visitTimeText}`; content.appendChild(t) }
          if (spot.kind === 'hotel' && spot.price) { const t = document.createElement('div'); t.style.fontSize = '11px'; t.style.color = '#475569'; t.textContent = `价格:${spot.price}`; content.appendChild(t) }
          if (spot.innerTransport) { const t = document.createElement('div'); t.style.fontSize = '11px'; t.style.color = '#475569'; t.textContent = `交通:${spot.innerTransport}`; content.appendChild(t) }
          if (spot.kind === 'sight' && spot.guideUrl) { const a = document.createElement('a'); a.href = spot.guideUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '攻略链接'; a.style.color = '#0d9488'; a.style.textDecoration = 'underline'; const wrap = document.createElement('div'); wrap.style.marginTop = '4px'; wrap.style.fontSize = '11px'; wrap.appendChild(a); content.appendChild(wrap) }
          if (spot.kind === 'restaurant' && spot.link) { const a = document.createElement('a'); a.href = spot.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '查看链接'; a.style.color = '#0d9488'; a.style.textDecoration = 'underline'; const wrap = document.createElement('div'); wrap.style.marginTop = '4px'; wrap.style.fontSize = '11px'; wrap.appendChild(a); content.appendChild(wrap) }
          const actionRow = document.createElement('div'); actionRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0'
          const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.textContent = '编辑'; editBtn.style.cssText = 'padding:3px 10px;border-radius:6px;border:1px solid #14b8a6;background:#14b8a6;color:#fff;font-size:11px;font-weight:600;cursor:pointer;'
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
    [cities, spots, dailyPlans, mapFocusSpotId, setSegmentMode, setSpotDetail, setLegend, routePolylinesRef, distanceLabelsRef, cityMarkersRef, spotMarkersRef, infoWindowRef, drawSeqRef, hasInitialFitRef, closeSegmentPopup],
  )

  return { drawRoutes }
}
