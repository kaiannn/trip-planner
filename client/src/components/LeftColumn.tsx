import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useMapApi } from '../map/MapContext'
import { useTripStore } from '../store/tripStore'
import { Btn, Field, Panel, inputClass } from './ui'
import { AiSeedPanel } from './AiSeedPanel'
import { SpotPoolPanel } from './SpotPoolPanel'

/**
 * Right-rail layout: AI seed panel (top) → Cities + Days (middle) →
 * Pool panel (bottom). The sidebar is scrollable as a whole but the
 * Pool has its own internal scroll so it doesn't disappear below the
 * fold when the day list grows.
 */
export function LeftColumn({ className }: { className?: string }) {
  const cities = useTripStore((s) => s.cities)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const autoSeedPending = useTripStore((s) => s.autoSeedPending)
  const addCity = useTripStore((s) => s.addCity)
  const moveCity = useTripStore((s) => s.moveCity)
  const deleteCity = useTripStore((s) => s.deleteCity)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const scheduleAiRefresh = useTripStore((s) => s.scheduleAiRefresh)
  const confirmAutoSeed = useTripStore((s) => s.confirmAutoSeed)
  const cancelAutoSeed = useTripStore((s) => s.cancelAutoSeed)
  const mapApi = useMapApi()

  const [cityName, setCityName] = useState('')

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.order - b.order),
    [cities],
  )

  const daySummary = useMemo(() => {
    if (!dailyPlans.length) return '尚未创建任何每日行程。'
    const days = dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex)
    return `共 ${days.length} 天 · ${days.reduce(
      (n, d) => n + d.spotOrder.length,
      0,
    )} 个景点已分配`
  }, [dailyPlans])

  return (
    <div
      className={clsx(
        'flex min-h-0 flex-col gap-2 overflow-y-auto pr-0.5',
        className,
      )}
    >
      <AiSeedPanel />

      <Panel title="城市">
        <div className="flex flex-wrap gap-1.5">
          <Field label="城市名称">
            <input
              className={inputClass}
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="例如：东京"
            />
          </Field>
          <Btn
            variant="secondary"
            className="self-end"
            onClick={() => {
              if (!cityName.trim()) return
              const city = addCity(cityName)
              setCityName('')
              mapApi?.geocodeCity(city)
              scheduleAiRefresh()
            }}
          >
            添加城市
          </Btn>
        </div>
        <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[12px]">
          {sortedCities.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-900/[0.03]"
            >
              <span className="font-medium text-slate-800">
                {i + 1}. {c.name}
              </span>
              <span className="flex gap-1">
                <Btn
                  variant="ghost"
                  className="!px-2 !py-0.5 text-xs"
                  onClick={() => moveCity(c.id, -1)}
                >
                  ↑
                </Btn>
                <Btn
                  variant="ghost"
                  className="!px-2 !py-0.5 text-xs"
                  onClick={() => moveCity(c.id, 1)}
                >
                  ↓
                </Btn>
                <Btn
                  variant="ghost"
                  className="!px-2 !py-0.5 text-xs text-red-600"
                  onClick={() => deleteCity(c.id)}
                >
                  删
                </Btn>
              </span>
            </li>
          ))}
        </ul>
        {autoSeedPending && (
          <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-[12px] text-slate-700">
            <p className="mb-1.5 font-medium">
              为「{autoSeedPending.city.name}」找到了{' '}
              {autoSeedPending.pois.length} 个推荐景点：
            </p>
            <p className="mb-2 text-slate-500">
              {autoSeedPending.pois.map((p) => p.name).filter(Boolean).join(' / ')}
            </p>
            <div className="flex gap-1.5">
              <Btn
                variant="primary"
                className="!py-1 !text-xs"
                onClick={confirmAutoSeed}
              >
                加入景点池
              </Btn>
              <Btn
                variant="ghost"
                className="!py-1 !text-xs"
                onClick={cancelAutoSeed}
              >
                跳过
              </Btn>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="按天行程">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-700">
            {daySummary}
          </p>
          <Btn
            variant="ghost"
            className="shrink-0 !py-1 !text-[12px]"
            onClick={() => setDayPlanOpen(true)}
          >
            时间线
          </Btn>
        </div>
      </Panel>

      <SpotPoolPanel />
    </div>
  )
}
