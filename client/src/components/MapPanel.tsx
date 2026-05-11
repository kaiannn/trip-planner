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
  // Cache driving-route results keyed by "lng1,lat1|lng2,lat2"
  // so zoom / pan / legend re-renders don't re-hit the AMap API.
  // (Module-level cache lives in lib/amapRouting.ts now; this ref is unused
  //  but kept here so existing setState plumbing is undisturbed.)
  const drawSeqRef = useRef(0)
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
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)
  const clearMapFocus = useTripStore((s) => s.clearMapFocus)
  const mapRedrawNonce = useTripStore((s) => s.mapRedrawNonce)
  const setSegmentMode = useTripStore((s) => s.setSegmentMode)
  const updateCityLocation = useTripStore((s) => s.updateCityLocation)
  const setPendingMapCoords = useTripStore((s) => s.setPendingMapCoords)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const pushLog = useTripStore((s) => s.pushLog)
  /** Track whether we've ever fit the view yet — gates the initial fit-view. */
  const hasInitialFitRef = useRef(false)

  const drawRoutes = useCallback(
    (map: AMap.Map, focusDayId: string | null) => {
      // Bump the render sequence. Any in-flight driving lookups from earlier
      // renders will see `drawSeqRef.current !== mySeq` and drop their results.
      drawSeqRef.current += 1
      const mySeq = drawSeqRef.current

      // ---- segment popup + context menu (closures over map/setSegmentMode) ----
      // Click the polyline -> show 4-mode comparison in the InfoWindow.
      const showSegmentPopup = (
        dayId: string,
        fromId: string,
        toId: string,
        a: { lat: number; lng: number },
        b: { lat: number; lng: number },
        currentMode: TransportMode,
        cityName: string | undefined,
      ) => {
        const AMapNs = window.AMap
        if (!AMapNs) return
        const wrap = document.createElement('div')
        wrap.style.minWidth = '200px'
        wrap.style.fontSize = '12px'
        const title = document.createElement('div')
        title.style.fontWeight = '600'
        title.style.marginBottom = '6px'
        const fromName =
          spots.find((s) => s.id === fromId)?.name ?? '起点'
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

        const iw = new AMapNs.InfoWindow({
          offset: new AMapNs.Pixel(0, -8),
        })
        iw.setContent(wrap)
        const midLng = (a.lng + b.lng) / 2
        const midLat = (a.lat + b.lat) / 2
        iw.open(map, new AMapNs.LngLat(midLng, midLat))

        // Resolve all four in parallel; replace the placeholder once we have
        // any data. Failed modes show as "-".
        fetchAllModes(a, b, { city: cityName }).then((all) => {
          list.innerHTML = ''
          ;(['driving', 'walking', 'transit', 'riding'] as TransportMode[]).forEach(
            (m) => {
              const row = document.createElement('button')
              row.type = 'button'
              row.style.cssText =
                'display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#334155;'
              if (m === currentMode) {
                row.style.background = '#ecfeff'
                row.style.borderColor = '#22d3ee'
                row.style.fontWeight = '600'
              }
              const r = all[m]
              const summary = r
                ? `${(r.distance / 1000).toFixed(1)} km · ${Math.max(
                    1,
                    Math.round(r.duration / 60),
                  )} 分钟`
                : '不可达'
              row.innerHTML = `
                <span style="width:1.2em;text-align:center">${TRANSPORT_ICON[m]}</span>
                <span style="flex:1">${TRANSPORT_LABEL[m]}</span>
                <span style="color:${r ? '#0f766e' : '#94a3b8'};font-variant-numeric:tabular-nums;">${summary}</span>
              `
              row.addEventListener('click', () => {
                setSegmentMode(dayId, fromId, toId, m)
                iw.open(map, new AMapNs.LngLat(midLng, midLat)) // keep visible
              })
              list.appendChild(row)
            },
          )
        })
      }

      // Right-click polyline -> floating mini menu (4 modes).
      const showSegmentMenu = (
        dayId: string,
        fromId: string,
        toId: string,
        currentMode: TransportMode,
        _cityName: string | undefined,
      ) => {
        // We can't position from a polyline event reliably without a fresh
        // pixel coord, so reuse the same InfoWindow flow but skip API calls
        // and just present the menu.
        const AMapNs = window.AMap
        if (!AMapNs) return
        const a = spots.find((s) => s.id === fromId)?.location
        const b = spots.find((s) => s.id === toId)?.location
        if (!a || !b) return
        const wrap = document.createElement('div')
        wrap.style.fontSize = '12px'
        wrap.style.minWidth = '140px'
        const title = document.createElement('div')
        title.style.fontWeight = '600'
        title.style.marginBottom = '4px'
        title.textContent = '选择交通方式'
        wrap.appendChild(title)
        ;(['driving', 'walking', 'transit', 'riding'] as TransportMode[]).forEach(
          (m) => {
            const row = document.createElement('button')
            row.type = 'button'
            row.style.cssText =
              'display:block;width:100%;padding:4px 8px;margin-top:2px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:#334155;'
            if (m === currentMode) {
              row.style.background = '#ecfeff'
              row.style.borderColor = '#22d3ee'
              row.style.fontWeight = '600'
            }
            row.textContent = `${TRANSPORT_ICON[m]} ${TRANSPORT_LABEL[m]}${
              m === currentMode ? ' ✓' : ''
            }`
            row.addEventListener('click', () => {
              setSegmentMode(dayId, fromId, toId, m)
              iw.close()
            })
            wrap.appendChild(row)
          },
        )
        const iw = new AMapNs.InfoWindow({
          offset: new AMapNs.Pixel(0, -8),
        })
        iw.setContent(wrap)
        const midLng = (a.lng + b.lng) / 2
        const midLat = (a.lat + b.lat) / 2
        iw.open(map, new AMapNs.LngLat(midLng, midLat))
      }

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
        const cityName = cities.find((c) => c.id === day.cityId)?.name
        if (coords.length >= 2) {
          // Draw a fallback straight line immediately so the user sees something
          // while the real driving routes resolve.
          const fallback = new AMap.Polyline({
            path: coords,
            strokeColor: color,
            strokeWeight: 2,
            strokeOpacity: 0.35,
            strokeStyle: 'dashed',
          })
          map.add(fallback)
          routePolylinesRef.current.push(fallback)

          for (let i = 0; i < orderedSpots.length - 1; i++) {
            const a = orderedSpots[i].location
            const b = orderedSpots[i + 1].location
            const fromId = orderedSpots[i].id
            const toId = orderedSpots[i + 1].id
            const segKey = `${fromId}|${toId}`
            const mode: TransportMode =
              day.segmentModes?.[segKey] ?? 'driving'

            fetchSegment(mode, a, b, { city: cityName })
              .then((seg) => {
                if (drawSeqRef.current !== mySeq) return // stale render
                const line = new AMap.Polyline({
                  path: seg.path,
                  strokeColor: color,
                  strokeWeight: 5,
                  strokeOpacity: 0.9,
                  strokeStyle: mode === 'driving' ? 'solid' : 'dashed',
                })
                map.add(line)
                routePolylinesRef.current.push(line)
                line.on('click', () =>
                  showSegmentPopup(day.id, fromId, toId, a, b, mode, cityName),
                )
                line.on('rightclick', () =>
                  showSegmentMenu(day.id, fromId, toId, mode, cityName),
                )

                const midIdx = Math.floor(seg.path.length / 2)
                const midPoint = seg.path[midIdx]
                const mid: [number, number] =
                  midPoint && midPoint.length >= 2
                    ? [midPoint[0], midPoint[1]]
                    : [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2]
                const km = (seg.distance / 1000).toFixed(1)
                const min = Math.max(1, Math.round(seg.duration / 60))
                const label = new AMap.Text({
                  text: `${TRANSPORT_ICON[mode]} ${km} km · ${min} 分钟`,
                  position: mid,
                  style: {
                    'background-color': 'rgba(255,255,255,0.95)',
                    'border-radius': '4px',
                    padding: '2px 6px',
                    'font-size': '10px',
                    border: `1px solid ${color}`,
                    color,
                    cursor: 'pointer',
                  },
                })
                map.add(label)
                distanceLabelsRef.current.push(label)
              })
              .catch(() => {
                // Routing failed — fall back to a straight line with
                // haversine distance so the user still sees something.
                if (drawSeqRef.current !== mySeq) return
                const line = new AMap.Polyline({
                  path: [
                    [a.lng, a.lat],
                    [b.lng, b.lat],
                  ],
                  strokeColor: color,
                  strokeWeight: 4,
                  strokeOpacity: 0.7,
                  strokeStyle: 'dashed',
                })
                map.add(line)
                routePolylinesRef.current.push(line)
                line.on('click', () =>
                  showSegmentPopup(day.id, fromId, toId, a, b, mode, cityName),
                )
                line.on('rightclick', () =>
                  showSegmentMenu(day.id, fromId, toId, mode, cityName),
                )
                const d = distanceInMeters(a.lat, a.lng, b.lat, b.lng)
                const label = new AMap.Text({
                  text: `${TRANSPORT_ICON[mode]} ${(d / 1000).toFixed(1)} km (直线)`,
                  position: [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2],
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
              })
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
          const content = document.createElement('div')
          content.textContent = `城市：${city.name}`
          infoWindowRef.current?.setContent(content)
          infoWindowRef.current?.open(map, marker.getPosition())
        })
        cityMarkersRef.current.push(marker)
      })

      spotMarkersRef.current.forEach((m) => m.setMap(null))
      spotMarkersRef.current = []

      // Which spots belong to which day (and which day color)?
      // Also collect all spot IDs that ARE assigned to any day, so we can
      // draw the remaining ones as grey pool pins.
      const assignedSpotIds = new Set<string>()
      const spotColorById = new Map<string, string>()
      daysToDraw.forEach((day, idx) => {
        const color = DAY_COLORS[idx % DAY_COLORS.length]
        day.spotOrder.forEach((sid) => {
          assignedSpotIds.add(sid)
          spotColorById.set(sid, color)
        })
      })

      spots.forEach((spot) => {
        const isPool = !assignedSpotIds.has(spot.id)
        const dayColor = spotColorById.get(spot.id)
        const isFocused = spot.id === mapFocusSpotId
        // Per-kind base color: hotels = red, restaurants = orange.
        // Sights inherit the day color (or grey for pool).
        let labelBg: string
        if (spot.kind === 'hotel') {
          labelBg = SPOT_KIND_COLOR.hotel
        } else if (spot.kind === 'restaurant') {
          labelBg = SPOT_KIND_COLOR.restaurant
        } else {
          labelBg = dayColor ?? SPOT_KIND_COLOR.sight
        }
        const labelWeight = '600'
        const icon = SPOT_KIND_ICON[spot.kind]
        // Focused spots get a persistent glow ring via box-shadow layering.
        const labelShadow = isFocused
          ? '0 0 0 2px #fff, 0 0 0 5px rgba(13,148,136,0.75), 0 4px 14px rgba(13,148,136,0.45)'
          : '0 1px 3px rgba(0,0,0,0.25)'
        const marker = new AMap.Marker({
          position: [spot.location.lng, spot.location.lat],
          title: spot.name,
          map,
          zIndex: isFocused ? 200 : isPool ? 50 : 100,
          label: {
            content: `<span style="display:inline-block;padding:1px 6px;border-radius:9999px;background:${labelBg};color:#fff;font-size:10px;font-weight:${labelWeight};box-shadow:${labelShadow}">${icon} ${spot.name}</span>`,
            direction: 'top',
          },
        })
        marker.on('click', () => {
          const content = document.createElement('div')
          content.className = 'amap-info-content'
          const nameDiv = document.createElement('div')
          nameDiv.style.fontWeight = '600'
          nameDiv.style.marginBottom = '4px'
          const kindLabel = SPOT_KIND_LABEL[spot.kind]
          nameDiv.textContent = `${icon} ${kindLabel}${
            isPool ? '(池)' : ''
          }: ${spot.name}`
          content.appendChild(nameDiv)
          if (spot.kind === 'sight' && spot.visitTimeText) {
            const t = document.createElement('div')
            t.style.fontSize = '11px'
            t.style.color = '#475569'
            t.textContent = `时间:${spot.visitTimeText}`
            content.appendChild(t)
          }
          if (spot.kind === 'hotel' && spot.price) {
            const t = document.createElement('div')
            t.style.fontSize = '11px'
            t.style.color = '#475569'
            t.textContent = `价格:${spot.price}`
            content.appendChild(t)
          }
          if (spot.innerTransport) {
            const t = document.createElement('div')
            t.style.fontSize = '11px'
            t.style.color = '#475569'
            t.textContent = `交通:${spot.innerTransport}`
            content.appendChild(t)
          }
          if (spot.kind === 'sight' && spot.guideUrl) {
            const a = document.createElement('a')
            a.href = spot.guideUrl
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.textContent = '攻略链接'
            a.style.color = '#0d9488'
            a.style.textDecoration = 'underline'
            const wrap = document.createElement('div')
            wrap.style.marginTop = '4px'
            wrap.style.fontSize = '11px'
            wrap.appendChild(a)
            content.appendChild(wrap)
          }
          if (spot.kind === 'restaurant' && spot.link) {
            const a = document.createElement('a')
            a.href = spot.link
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.textContent = '查看链接'
            a.style.color = '#0d9488'
            a.style.textDecoration = 'underline'
            const wrap = document.createElement('div')
            wrap.style.marginTop = '4px'
            wrap.style.fontSize = '11px'
            wrap.appendChild(a)
            content.appendChild(wrap)
          }

          // Action row: 编辑 + 定位
          const actionRow = document.createElement('div')
          actionRow.style.display = 'flex'
          actionRow.style.gap = '6px'
          actionRow.style.marginTop = '8px'
          actionRow.style.paddingTop = '6px'
          actionRow.style.borderTop = '1px solid #e2e8f0'

          const editBtn = document.createElement('button')
          editBtn.type = 'button'
          editBtn.textContent = '✏️ 编辑'
          editBtn.style.cssText =
            'padding:3px 10px;border-radius:6px;border:1px solid #14b8a6;background:#14b8a6;color:#fff;font-size:11px;font-weight:600;cursor:pointer;'
          editBtn.addEventListener('click', () => {
            setSpotDetail(spot)
          })
          actionRow.appendChild(editBtn)

          content.appendChild(actionRow)

          infoWindowRef.current?.setContent(content)
          infoWindowRef.current?.open(map, marker.getPosition())
        })
        spotMarkersRef.current.push(marker)
      })

      // Only fit-view on the very first meaningful render. After that the
      // user is in charge of the camera; click-to-focus pans explicitly via
      // panTo, and 重置视图 calls setFitView on demand.
      if (!hasInitialFitRef.current) {
        const overlays: AMap.Overlay[] = [
          ...cityMarkersRef.current,
          ...spotMarkersRef.current,
          ...routePolylinesRef.current,
        ]
        if (overlays.length) {
          map.setFitView(overlays)
          hasInitialFitRef.current = true
        }
      }
    },
    [cities, spots, dailyPlans, mapFocusSpotId],
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

    const src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapKey)}&plugin=AMap.Geocoder,AMap.Driving,AMap.Walking,AMap.Transfer,AMap.Riding,AMap.AutoComplete,AMap.PlaceSearch`

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
    window.AMap.plugin(
      [
        'AMap.Geocoder',
        'AMap.Driving',
        'AMap.Walking',
        'AMap.Transfer',
        'AMap.Riding',
        'AMap.AutoComplete',
        'AMap.PlaceSearch',
      ],
      () => {},
    )

    map.on('rightclick', (e: AMap.MapEvent) => {
      const lnglat = e.lnglat
      const lat = lnglat.getLat()
      const lng = lnglat.getLng()
      // Record coords immediately so forms can fill them in without waiting.
      setPendingMapCoords({ lat, lng })
      pushLog(`已记录经纬度(可填入表单):${lat.toFixed(4)}, ${lng.toFixed(4)}`)

      // Then best-effort reverse geocode to also suggest a name + address.
      // Any failure is silent — the coords alone are still useful.
      const AMapNs = window.AMap
      if (AMapNs?.Geocoder) {
        try {
          const g = new AMapNs.Geocoder({ radius: 200, extensions: 'all' })
          g.getAddress([lng, lat], (status, result) => {
            if (
              status !== 'complete' ||
              result.info !== 'OK' ||
              !result.regeocode
            ) {
              return
            }
            const re = result.regeocode
            const poiName = re.pois?.[0]?.name
            const buildingName = re.addressComponent?.building?.name
            const neighborhoodName = re.addressComponent?.neighborhood?.name
            const suggestedName =
              poiName || buildingName || neighborhoodName || null
            const address = re.formatted_address || null
            if (suggestedName || address) {
              useTripStore
                .getState()
                .setPendingMapSuggestion(suggestedName, address)
              pushLog(
                `反向地理:${suggestedName ?? '(无名)'}${address ? ` · ${address}` : ''}`,
              )
            }
          })
        } catch {
          // ignore — graceful degrade to coords-only
        }
      }
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

  // Pan to the focused spot whenever mapFocusSpotId changes. Pan only —
  // zoom level stays where the user left it (UX choice B).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocusSpotId) return
    const spot = spots.find((s) => s.id === mapFocusSpotId)
    if (!spot) return
    try {
      map.panTo([spot.location.lng, spot.location.lat])
    } catch {
      // panTo not supported — fall back to setCenter
      try {
        map.setCenter([spot.location.lng, spot.location.lat])
      } catch {
        /* ignore */
      }
    }
  }, [mapFocusSpotId, spots])

  // When a day is focused, fit-view onto only that day's spots so the
  // user sees the whole day's geographic shape.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapFocusDayId) return
    const day = dailyPlans.find((d) => d.id === mapFocusDayId)
    if (!day || !day.spotOrder.length) return
    const dayMarkers = spotMarkersRef.current.filter((_, i) => {
      // The order of spotMarkersRef matches the spots array passed to draw.
      // We re-derive the matching spot id by index against the current spots[].
      const spotId = spots[i]?.id
      return spotId ? day.spotOrder.includes(spotId) : false
    })
    if (dayMarkers.length) {
      try {
        map.setFitView(dayMarkers)
      } catch {
        /* ignore */
      }
    }
  }, [mapFocusDayId, dailyPlans, spots])

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
        <div className="w-[min(380px,38vw)] shrink-0">{sidebar}</div>
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
            {(mapFocusSpotId || mapFocusDayId) && (
              <button
                type="button"
                onClick={() => {
                  clearMapFocus()
                  // Return to an overview fit-view across everything.
                  const map = mapRef.current
                  const AMapNs = window.AMap
                  if (map && AMapNs) {
                    const overlays: AMap.Overlay[] = [
                      ...cityMarkersRef.current,
                      ...spotMarkersRef.current,
                      ...routePolylinesRef.current,
                    ]
                    if (overlays.length) {
                      try {
                        map.setFitView(overlays)
                      } catch {
                        /* ignore */
                      }
                    }
                  }
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700 shadow-sm transition hover:bg-teal-50"
                title="清除焦点,缩回总览"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 2A2.5 2.5 0 0 0 2 4.5v3a.75.75 0 0 0 1.5 0v-3a1 1 0 0 1 1-1h3a.75.75 0 0 0 0-1.5h-3Zm8 0a.75.75 0 0 0 0 1.5h3a1 1 0 0 1 1 1v3a.75.75 0 0 0 1.5 0v-3A2.5 2.5 0 0 0 15.5 2h-3Zm-8.75 10.25a.75.75 0 0 1 .75.75v3a1 1 0 0 0 1 1h3a.75.75 0 0 1 0 1.5h-3A2.5 2.5 0 0 1 2 15.5v-3a.75.75 0 0 1 .75-.75Zm13.5 0a.75.75 0 0 1 .75.75v3a2.5 2.5 0 0 1-2.5 2.5h-3a.75.75 0 0 1 0-1.5h3a1 1 0 0 0 1-1v-3a.75.75 0 0 1 .75-.75Z"
                    clipRule="evenodd"
                  />
                </svg>
                重置视图
              </button>
            )}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {mapLoadError && (
              <div className="absolute inset-0 z-[5] flex flex-col justify-center gap-2 overflow-auto bg-amber-50/95 p-4 text-left text-xs leading-relaxed text-amber-950 ring-1 ring-amber-200">
                <p className="font-semibold">地图未就绪</p>
                <p className="whitespace-pre-wrap">{mapLoadError}</p>
                <p className="text-amber-800/90">
                  排查:① 浏览器 F12 → Console / Network 是否有高德报错(如 INVALID_USER_KEY、USERKEY_PLAT_NOMATCH)②
                  控制台 Key 须为「Web 端」,且与 VITE_AMAP_KEY 一致;启用安全密钥时须配置 VITE_AMAP_SECURITY_CODE ③
                  Key 安全设置里放行访问来源(如 localhost、127.0.0.1)④ 修改 client/.env 后必须重启 npm run dev
                </p>
              </div>
            )}
            <div ref={containerRef} className="min-h-0 w-full flex-1" />
          </div>
        </div>
      </div>
    </MapContext.Provider>
  )
}
