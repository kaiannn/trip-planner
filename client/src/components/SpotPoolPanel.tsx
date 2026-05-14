import { useMemo, useState } from 'react'
import { useTripStore } from '../store/tripStore'
import { Btn } from './ui'
import { SpotContextMenu, useSpotContextMenu } from './SpotContextMenu'
import {
  SPOT_KIND_ICON,
  SPOT_KIND_LABEL,
  spotKind,
} from '../lib/spotKind'
import type { SpotKind } from '../types'

type Filter = 'all' | SpotKind

/**
 * Persistent Pool panel at the bottom of the right rail. Shows
 * unassigned spots and a summary. Interactions:
 *   - single click  -> focus on map
 *   - ✏️ pencil icon -> open edit modal
 *   - right click   -> context menu
 *   - double click  -> open edit modal (back-compat)
 */
export function SpotPoolPanel() {
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const cities = useTripStore((s) => s.cities)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const setSpotPoolOpen = useTripStore((s) => s.setSpotPoolOpen)
  const mapFocusSpotId = useTripStore((s) => s.mapFocusSpotId)
  const setMapFocusSpotId = useTripStore((s) => s.setMapFocusSpotId)
  const menu = useSpotContextMenu()

  const [filter, setFilter] = useState<Filter>('all')

  const assignedIds = useMemo(() => {
    const set = new Set<string>()
    dailyPlans.forEach((d) => d.spotOrder.forEach((id) => set.add(id)))
    return set
  }, [dailyPlans])

  const unassigned = useMemo(
    () => spots.filter((s) => !assignedIds.has(s.id)),
    [spots, assignedIds],
  )

  const counts = useMemo(() => {
    const out = { all: 0, sight: 0, hotel: 0, restaurant: 0 }
    unassigned.forEach((s) => {
      out.all += 1
      out[spotKind(s)] += 1
    })
    return out
  }, [unassigned])

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? unassigned
        : unassigned.filter((s) => spotKind(s) === filter),
    [unassigned, filter],
  )

  const cityName = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? '未知城市'

  const TabBtn = ({
    value,
    label,
    count,
  }: {
    value: Filter
    label: string
    count: number
  }) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
        filter === value
          ? 'bg-teal-600 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50/50'
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[9px] ${
          filter === value ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  )

  return (
    <section className="warm-card shadow-stone-sm flex min-h-[12rem] flex-1 flex-col overflow-hidden border border-slate-200/80 bg-[#f8f2e4]">
      <header className="flex shrink-0 flex-col gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">
              📌 景点池
              <span className="ml-1.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                {unassigned.length} 未分配 · {spots.length} 总数
              </span>
            </div>
        </div>
          <Btn
            variant="ghost"
            className="!py-1 !text-[11px]"
            onClick={() => setSpotPoolOpen(true)}
          >
            添加 / 搜索
          </Btn>
        </div>
        <div className="flex flex-wrap gap-1">
          <TabBtn value="all" label="全部" count={counts.all} />
          <TabBtn
            value="sight"
            label={`${SPOT_KIND_ICON.sight} ${SPOT_KIND_LABEL.sight}`}
            count={counts.sight}
          />
          <TabBtn
            value="hotel"
            label={`${SPOT_KIND_ICON.hotel} ${SPOT_KIND_LABEL.hotel}`}
            count={counts.hotel}
          />
          <TabBtn
            value="restaurant"
            label={`${SPOT_KIND_ICON.restaurant} ${SPOT_KIND_LABEL.restaurant}`}
            count={counts.restaurant}
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-slate-400">
            {spots.length === 0
              ? '景点池为空。上方让 AI 帮你填,或点「添加 / 搜索」手动加。'
              : filter === 'all'
                ? '全部景点都已分配到某一天。'
                : `这里没有未分配的${SPOT_KIND_LABEL[filter as SpotKind]}。`}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((s) => {
              const focused = mapFocusSpotId === s.id
              const k = spotKind(s)
              return (
                <li key={s.id}>
                  <div
                    onContextMenu={(e) => menu.open(e, s)}
                    title="右键查看更多"
                    className={`group flex w-full items-center gap-2 rounded-lg border bg-white py-1.5 pl-2.5 pr-1.5 shadow-sm transition ${
                      focused
                        ? 'border-teal-400 ring-2 ring-teal-200'
                        : 'border-slate-100 hover:border-teal-200 hover:bg-teal-50/30'
                    }`}
                  >
                    <span
                      className="text-[14px]"
                      title={SPOT_KIND_LABEL[k]}
                    >
                      {SPOT_KIND_ICON[k]}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMapFocusSpotId(s.id)}
                      onDoubleClick={() => setSpotDetail(s)}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-slate-800 group-hover:text-teal-900"
                      title="单击定位"
                    >
                      {s.name}
                    </button>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {cityName(s.cityId)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSpotDetail(s)}
                      className="shrink-0 rounded px-1 py-0.5 text-[12px] text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-teal-700 group-hover:opacity-100"
                      title="编辑"
                      aria-label="编辑"
                    >
                      ✏️
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <SpotContextMenu menu={menu} />
    </section>
  )
}
