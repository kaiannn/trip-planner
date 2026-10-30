import { useState, type FormEvent } from 'react'
import { useTripStore } from '../../store'
import { useCyclingStore } from '../../cycling/store'
import { Btn, inputClass } from '../ui'

/**
 * First-run empty state: create a city, load demo, or open the route book.
 * Shown only when the trip has neither cities nor spots.
 */
export function EmptyTripCta() {
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const addCity = useTripStore((s) => s.addCity)
  const loadDemoData = useTripStore((s) => s.loadDemoData)
  const setCyclingOpen = useCyclingStore((s) => s.setOpen)

  const [cityName, setCityName] = useState('')

  // Defensive: bad rehydrate must not crash the whole map layout.
  const safeCities = cities ?? []
  const safeSpots = spots ?? []
  if (safeCities.length > 0 || safeSpots.length > 0) return null

  const onCreateCity = (e: FormEvent) => {
    e.preventDefault()
    const name = cityName.trim()
    if (!name) return
    addCity(name)
    setCityName('')
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          从一座城市开始
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          输入想去的城市，行程会自动保存在这台设备的浏览器里。
        </p>

        <form onSubmit={onCreateCity} className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="empty-trip-city">
            城市名称
          </label>
          <input
            id="empty-trip-city"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="例如：杭州"
            className={inputClass}
            autoComplete="address-level2"
          />
          <Btn type="submit" variant="primary" disabled={!cityName.trim()} className="shrink-0">
            开始规划
          </Btn>
        </form>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Btn
            onClick={() => {
              loadDemoData()
            }}
            variant="secondary"
          >
            加载杭州示例
          </Btn>
          <Btn onClick={() => setCyclingOpen(true)} variant="ghost">
            骑行路书
          </Btn>
        </div>

        <p className="mt-3 text-[12px] text-slate-500">
          创建城市后可从地图右上角 AI 推荐，或用高德 POI 加景点，再拖进每天的日程。
        </p>
      </div>
    </div>
  )
}
