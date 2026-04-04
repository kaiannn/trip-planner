import { useEffect, useMemo, useState } from 'react'
import { useMapApi } from '../map/MapContext'
import { useTripStore } from '../store/tripStore'
import { Btn, Field, Panel, inputClass } from './ui'
import clsx from 'clsx'

export function LeftColumn({ className }: { className?: string }) {
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const aiCityId = useTripStore((s) => s.aiCityId)
  const aiBudget = useTripStore((s) => s.aiBudget)
  const pendingMapCoords = useTripStore((s) => s.pendingMapCoords)
  const setPendingMapCoords = useTripStore((s) => s.setPendingMapCoords)
  const addCity = useTripStore((s) => s.addCity)
  const moveCity = useTripStore((s) => s.moveCity)
  const deleteCity = useTripStore((s) => s.deleteCity)
  const setAiCityId = useTripStore((s) => s.setAiCityId)
  const setAiBudget = useTripStore((s) => s.setAiBudget)
  const setSpotPoolOpen = useTripStore((s) => s.setSpotPoolOpen)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const scheduleAiRefresh = useTripStore((s) => s.scheduleAiRefresh)
  const autoSeedPoisForCity = useTripStore((s) => s.autoSeedPoisForCity)
  const mapApi = useMapApi()

  const [cityName, setCityName] = useState('')
  const [cityLat, setCityLat] = useState('')
  const [cityLng, setCityLng] = useState('')

  useEffect(() => {
    if (pendingMapCoords) {
      setCityLat(pendingMapCoords.lat.toFixed(6))
      setCityLng(pendingMapCoords.lng.toFixed(6))
    }
  }, [pendingMapCoords])

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.order - b.order),
    [cities],
  )

  useEffect(() => {
    if (!aiCityId && cities[0]) setAiCityId(cities[0].id)
  }, [aiCityId, cities, setAiCityId])

  const daySummary = useMemo(() => {
    if (!dailyPlans.length) return '尚未创建任何每日行程。'
    const days = dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex)
    const missing = days.filter((d) => !d.lodging?.name).length
    return `已创建 ${days.length} 天行程${
      missing ? `，其中 ${missing} 天未填写住宿` : '，所有天数都已填写住宿'
    }。`
  }, [dailyPlans])

  return (
    <div className={clsx('flex min-h-0 flex-col gap-2 overflow-y-auto pr-0.5', className)}>
      <Panel title="城市与交通">
        <div className="flex flex-wrap gap-1.5">
          <Field label="城市名称">
            <input
              className={inputClass}
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="例如：东京"
            />
          </Field>
          <Field label="纬度（可选）">
            <input
              type="number"
              step="0.000001"
              className={inputClass}
              value={cityLat}
              onChange={(e) => setCityLat(e.target.value)}
            />
          </Field>
          <Field label="经度（可选）">
            <input
              type="number"
              step="0.000001"
              className={inputClass}
              value={cityLng}
              onChange={(e) => setCityLng(e.target.value)}
            />
          </Field>
          <Btn
            variant="secondary"
            className="self-end"
            onClick={() => {
              if (!cityName.trim()) return
              const lat = parseFloat(cityLat)
              const lng = parseFloat(cityLng)
              const city = addCity(
                cityName,
                Number.isNaN(lat) ? undefined : lat,
                Number.isNaN(lng) ? undefined : lng,
              )
              setCityName('')
              setPendingMapCoords(null)
              if (!city.location) {
                mapApi?.geocodeCity(city)
              } else {
                autoSeedPoisForCity(city)
              }
              scheduleAiRefresh()
            }}
          >
            添加城市
          </Btn>
        </div>
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[12px]">
          {sortedCities.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-900/[0.03]"
            >
              <span className="font-medium text-slate-800">
                {i + 1}. {c.name}
              </span>
              <span className="flex gap-1">
                <Btn variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => moveCity(c.id, -1)}>
                  ↑
                </Btn>
                <Btn variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => moveCity(c.id, 1)}>
                  ↓
                </Btn>
                <Btn variant="ghost" className="!px-2 !py-0.5 text-xs text-red-600" onClick={() => deleteCity(c.id)}>
                  删
                </Btn>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="景点池">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-slate-600">{spots.length} 个</span>
          <Btn variant="primary" onClick={() => setSpotPoolOpen(true)}>
            管理
          </Btn>
        </div>
      </Panel>

      <Panel title="按天行程">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-700">{daySummary}</p>
          <Btn variant="ghost" className="shrink-0 !py-1 !text-[12px]" onClick={() => setDayPlanOpen(true)}>
            时间线
          </Btn>
        </div>
      </Panel>

      <Panel title="AI 偏好">
        <div className="flex flex-wrap gap-1.5">
          <Field label="侧重城市">
            <select
              className={inputClass}
              value={aiCityId}
              onChange={(e) => setAiCityId(e.target.value)}
            >
              <option value="">自动（第一个城市）</option>
              {sortedCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="预算（元/天）">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={aiBudget}
              onChange={(e) => setAiBudget(e.target.value)}
              placeholder="800"
            />
          </Field>
        </div>
      </Panel>
    </div>
  )
}
