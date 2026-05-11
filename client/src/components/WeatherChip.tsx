import { useEffect, useState } from 'react'

interface WeatherSnapshot {
  date: string
  dayweather: string
  nightweather: string
  daytemp: number
  nighttemp: number
}

// Small icon map for the common 高德 weather strings.
function iconFor(text: string): string {
  if (!text) return '☁️'
  if (/晴/.test(text)) return '☀️'
  if (/多云/.test(text)) return '⛅'
  if (/阴/.test(text)) return '☁️'
  if (/雷/.test(text)) return '⛈'
  if (/雨/.test(text)) return '🌧'
  if (/雪/.test(text)) return '❄️'
  if (/雾|霾|尘/.test(text)) return '🌫'
  if (/风/.test(text)) return '💨'
  return '🌤'
}

const weatherCache = new Map<string, WeatherSnapshot[]>()

/** Best-effort city-level forecast. Caches per city for the page session. */
function fetchForecast(city: string): Promise<WeatherSnapshot[]> {
  if (!city) return Promise.resolve([])
  const cached = weatherCache.get(city)
  if (cached) return Promise.resolve(cached)
  const AMapNs = typeof window !== 'undefined' ? window.AMap : undefined
  if (!AMapNs?.Weather) return Promise.resolve([])
  return new Promise((resolve) => {
    try {
      const svc = new AMapNs.Weather()
      svc.getForecast(city, (err, data) => {
        if (err || !data?.forecasts?.length) return resolve([])
        const list = data.forecasts.map((f) => ({
          date: f.date,
          dayweather: f.dayweather,
          nightweather: f.nightweather,
          daytemp: Number(f.daytemp),
          nighttemp: Number(f.nighttemp),
        }))
        weatherCache.set(city, list)
        resolve(list)
      })
    } catch {
      resolve([])
    }
  })
}

/**
 * Tiny weather chip for a day card. Shows an icon + day/night temperature
 * only when we have a forecast for that specific date. Silent no-render
 * when the day has no date, no city, or the API fails.
 */
export function WeatherChip({
  city,
  date,
}: {
  city?: string
  date?: string
}) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null)

  useEffect(() => {
    if (!city || !date) {
      setSnap(null)
      return
    }
    let cancelled = false
    fetchForecast(city).then((list) => {
      if (cancelled) return
      const match = list.find((f) => f.date === date)
      setSnap(match ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [city, date])

  if (!snap) return null
  const icon = iconFor(snap.dayweather || snap.nightweather)
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200"
      title={`${snap.dayweather} / ${snap.nightweather}`}
    >
      <span>{icon}</span>
      <span>{snap.nighttemp}°–{snap.daytemp}°</span>
    </span>
  )
}
