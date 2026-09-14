import { useCallback, useEffect, useRef } from 'react'
import { useAmapScript } from '../components/map/useAmapScript'
import { CYCLING_STOP_KIND_ICON } from './types'
import { useCyclingStore } from './store'

export function CyclingMap({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMap.Map | null>(null)
  const polyRef = useRef<AMap.Polyline | null>(null)
  const markersRef = useRef<AMap.Marker[]>([])
  const drawSeqRef = useRef(0)

  const plannedPath = useCyclingStore((s) => s.plannedPath)
  const stops = useCyclingStore((s) => s.stops)
  const nearbyResults = useCyclingStore((s) => s.nearbyResults)

  const reportError = useCallback(() => {
    /* 主界面已提示；地图加载错误交由 overlay 可选 */
  }, [])

  const { scriptReady, mapLoadError } = useAmapScript(reportError)

  useEffect(() => {
    if (!scriptReady || !containerRef.current || mapRef.current) return
    mapRef.current = new window.AMap!.Map(containerRef.current, {
      zoom: 11,
      viewMode: '2D',
    })
    return () => {
      mapRef.current?.destroy()
      mapRef.current = null
      polyRef.current = null
      markersRef.current = []
    }
  }, [scriptReady])

  // Draw route + stops
  useEffect(() => {
    const map = mapRef.current
    if (!map || !scriptReady) return
    drawSeqRef.current += 1

    // clear
    if (polyRef.current) {
      polyRef.current.setMap(null)
      polyRef.current = null
    }
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const overlays: AMap.Overlay[] = []

    if (plannedPath.length >= 2) {
      const poly = new window.AMap!.Polyline({
        path: plannedPath,
        strokeColor: '#0d9488',
        strokeWeight: 5,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
      })
      poly.setMap(map)
      polyRef.current = poly
      overlays.push(poly)
    }

    for (const stop of stops) {
      if (!stop.location) continue
      const icon = CYCLING_STOP_KIND_ICON[stop.kind] || '📍'
      const marker = new window.AMap!.Marker({
        position: [stop.location.lng, stop.location.lat],
        title: stop.name,
        label: {
          content: `${icon} ${stop.name}`,
          direction: 'top',
        },
      })
      marker.setMap(map)
      markersRef.current.push(marker)
      overlays.push(marker)
    }

    for (const poi of nearbyResults) {
      const marker = new window.AMap!.Marker({
        position: [poi.location.lng, poi.location.lat],
        title: poi.name,
        label: {
          content: `🔍 ${poi.name}`,
          direction: 'bottom',
        },
        zIndex: 80,
      })
      marker.setMap(map)
      markersRef.current.push(marker)
    }

    if (overlays.length) {
      map.setFitView(overlays as never)
    }
  }, [scriptReady, plannedPath, stops, nearbyResults])

  // Keep map sized when modal animates
  useEffect(() => {
    const t = window.setTimeout(() => mapRef.current?.resize(), 250)
    return () => window.clearTimeout(t)
  }, [scriptReady])

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${className ?? ''}`}>
      <div ref={containerRef} className="h-full w-full" />
      {mapLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 p-4 text-center text-[12px] text-slate-600">
          {mapLoadError}
        </div>
      )}
      {!mapLoadError && !scriptReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70 text-[12px] text-slate-500">
          地图加载中…
        </div>
      )}
    </div>
  )
}
