import { useMemo, useState } from 'react'
import { useMapApi } from '../map/MapContext'
import { useTripStore } from '../store/tripStore'
import { Btn, Field, Panel, inputClass } from './ui'
import { AiSeedPanel } from './AiSeedPanel'
import { SpotPoolPanel } from './SpotPoolPanel'

/**
 * Step 1 — Collect mode.
 *
 * User's job here: collect candidate spots. They describe their trip
 * (AI seeds the pool), add cities, and/or manually add spots. The
 * map on the right shows where everything is. No day planning yet.
 *
 * When they're ready, "完成,开始安排 →" creates days for the trip
 * date range and flips the app into arrange mode.
 */
export function CollectPanel({ className }: { className?: string }) {
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const autoSeedPending = useTripStore((s) => s.autoSeedPending)
  const addCity = useTripStore((s) => s.addCity)
  const moveCity = useTripStore((s) => s.moveCity)
  const deleteCity = useTripStore((s) => s.deleteCity)
  const scheduleAiRefresh = useTripStore((s) => s.scheduleAiRefresh)
  const confirmAutoSeed = useTripStore((s) => s.confirmAutoSeed)
  const cancelAutoSeed = useTripStore((s) => s.cancelAutoSeed)
  const ensureDaysForDateRange = useTripStore((s) => s.ensureDaysForDateRange)
  const setAppMode = useTripStore((s) => s.setAppMode)
  const pushLog = useTripStore((s) => s.pushLog)
  const mapApi = useMapApi()

  const [cityName, setCityName] = useState('')

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.order - b.order),
    [cities],
  )

  const canProceed = cities.length > 0 && spots.length > 0

  const handleDone = () => {
    if (!canProceed) {
      pushLog('请先至少添加一个城市,并往景点池放一个景点,再进入安排模式。', 'warn')
      return
    }
    ensureDaysForDateRange()
    setAppMode('arrange')
  }

  return (
    <div className={`flex min-h-0 flex-col gap-2 overflow-y-auto pr-0.5 ${className ?? ''}`}>
      <div className="shrink-0 rounded-xl border border-teal-200/60 bg-teal-50/40 px-3 py-2 text-[11px] text-teal-900/80">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
            1
          </span>
          <span className="font-semibold text-teal-900">填景点池</span>
        </div>
        <p className="mt-1 leading-relaxed">
          描述你想去哪,让 AI 帮你搜集候选;或自己搜索添加。填好后点下面的按钮进入第二步,把景点分配到每一天。
        </p>
      </div>

      <AiSeedPanel />

      <Panel title="城市">
        <div className="flex flex-wrap gap-1.5">
          <Field label="城市名称">
            <input
              className={inputClass}
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="例如:东京"
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
                <Btn variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => moveCity(c.id, -1)}>↑</Btn>
                <Btn variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={() => moveCity(c.id, 1)}>↓</Btn>
                <Btn variant="ghost" className="!px-2 !py-0.5 text-xs text-red-600" onClick={() => deleteCity(c.id)}>删</Btn>
              </span>
            </li>
          ))}
        </ul>
        {autoSeedPending && (
          <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-[12px] text-slate-700">
            <p className="mb-1.5 font-medium">
              为「{autoSeedPending.city.name}」找到了 {autoSeedPending.pois.length} 个推荐景点:
            </p>
            <p className="mb-2 text-slate-500">
              {autoSeedPending.pois.map((p) => p.name).filter(Boolean).join(' / ')}
            </p>
            <div className="flex gap-1.5">
              <Btn variant="primary" className="!py-1 !text-xs" onClick={confirmAutoSeed}>加入景点池</Btn>
              <Btn variant="ghost" className="!py-1 !text-xs" onClick={cancelAutoSeed}>跳过</Btn>
            </div>
          </div>
        )}
      </Panel>

      <SpotPoolPanel />

      <div className="sticky bottom-0 shrink-0 border-t border-slate-200/60 bg-white/95 px-0.5 pt-2 pb-0.5 backdrop-blur">
        <Btn
          variant="primary"
          className={`w-full justify-center !py-2.5 text-sm font-semibold ${
            canProceed ? '' : 'opacity-50'
          }`}
          onClick={handleDone}
        >
          完成,开始安排 →
        </Btn>
        {!canProceed && (
          <p className="mt-1 text-center text-[10px] text-slate-400">
            至少需要一个城市和一个景点
          </p>
        )}
      </div>
    </div>
  )
}
