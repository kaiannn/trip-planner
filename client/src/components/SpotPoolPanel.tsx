import { useMemo } from 'react'
import { useTripStore } from '../store/tripStore'
import { Btn } from './ui'
import { SpotContextMenu, useSpotContextMenu } from './SpotContextMenu'

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

  const assignedIds = useMemo(() => {
    const set = new Set<string>()
    dailyPlans.forEach((d) => d.spotOrder.forEach((id) => set.add(id)))
    return set
  }, [dailyPlans])

  const unassigned = useMemo(
    () => spots.filter((s) => !assignedIds.has(s.id)),
    [spots, assignedIds],
  )

  const cityName = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? '未知城市'

  return (
    <section className="flex min-h-[12rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            📌 景点池
            <span className="ml-1.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
              {unassigned.length} 未分配 · {spots.length} 总数
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            单击定位 · ✏️ 编辑 · 右键更多
          </div>
        </div>
        <Btn
          variant="ghost"
          className="!py-1 !text-[11px]"
          onClick={() => setSpotPoolOpen(true)}
        >
          添加 / 搜索
        </Btn>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {unassigned.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-slate-400">
            {spots.length === 0
              ? '景点池为空。上方让 AI 帮你填,或点「添加 / 搜索」手动加。'
              : '全部景点都已分配到某一天。'}
          </p>
        ) : (
          <ul className="space-y-1">
            {unassigned.map((s) => {
              const focused = mapFocusSpotId === s.id
              return (
                <li key={s.id}>
                  <div
                    onContextMenu={(e) => menu.open(e, s)}
                    className={`group flex w-full items-center gap-2 rounded-lg border bg-white py-1.5 pl-2.5 pr-1.5 shadow-sm transition ${
                      focused
                        ? 'border-teal-400 ring-2 ring-teal-200'
                        : 'border-slate-100 hover:border-teal-200 hover:bg-teal-50/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setMapFocusSpotId(s.id)}
                      onDoubleClick={() => setSpotDetail(s)}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-slate-800 group-hover:text-teal-900"
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
