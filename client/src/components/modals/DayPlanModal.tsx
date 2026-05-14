import { useEffect, useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { Btn, Field } from '../ui'
import { WeatherChip } from '../WeatherChip'

/**
 * Day details editor.
 *
 * This used to be a catch-all modal that duplicated spot add/reorder/remove
 * controls already available inline on the day card. That duplication made
 * the UI confusing, and the modal also silently opened on whichever day was
 * last active rather than the card the user actually clicked.
 *
 * Current responsibilities, scoped down to what's unique to this modal:
 *   - Set the per-day date (source of truth for the weather chip)
 *   - Lodging name + address
 *   - Free-text transport note for the day
 *   - "AI 补充景点" — extend this day's spots by prompt
 *   - Delete the day
 *
 * Spot order / add / remove is handled on the day card itself in ArrangePanel.
 * City is inferred from the day and not editable here — changing a day's city
 * would invalidate its spot list and should be a deliberate action, not a
 * side-effect of opening this modal.
 */
export function DayPlanModal() {
  const open = useTripStore((s) => s.dayPlanOpen)
  const editDayId = useTripStore((s) => s.dayPlanEditDayId)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const cities = useTripStore((s) => s.cities)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const saveDay = useTripStore((s) => s.saveDay)
  const deleteDay = useTripStore((s) => s.deleteDay)
  const extendDaySpotsByAI = useTripStore((s) => s.extendDaySpotsByAI)

  const day = dailyPlans.find((d) => d.id === editDayId) ?? null
  const city = day ? cities.find((c) => c.id === day.cityId) : null

  const [date, setDate] = useState('')
  const [lodgingName, setLodgingName] = useState('')
  const [lodgingAddr, setLodgingAddr] = useState('')
  const [transportMode, setTransportMode] = useState('')

  // Reload local form state whenever the modal is asked to focus a
  // different day. Guarded on `open` so closing the modal doesn't
  // immediately rehydrate (which would overwrite any in-progress edits
  // if the user reopens).
  useEffect(() => {
    if (!open || !day) return
    setDate(day.date || '')
    setLodgingName(day.lodging?.name || '')
    setLodgingAddr(day.lodging?.address || '')
    setTransportMode(day.transportMode || '')
  }, [open, day])

  if (!open) return null

  // Defensive empty state — shouldn't happen in practice because 编辑 only
  // appears on existing day cards, but keeps the modal resilient if a day
  // gets deleted while the modal is open.
  if (!day) {
    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && setDayPlanOpen(false)}
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <p className="text-sm text-slate-500">没有选中要编辑的天。</p>
          <div className="mt-4 text-right">
            <Btn variant="secondary" onClick={() => setDayPlanOpen(false)}>
              关闭
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  const handleSave = () => {
    saveDay({
      dayIndex: day.dayIndex,
      cityId: day.cityId,
      date: date || undefined,
      lodging: {
        name: lodgingName || undefined,
        address: lodgingAddr || undefined,
      },
      spotOrder: day.spotOrder,
      transportMode: transportMode || undefined,
    })
    setDayPlanOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setDayPlanOpen(false)}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              第 {day.dayIndex} 天 详情
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {city?.name || '未分配城市'} · {day.spotOrder.length} 个景点
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDayPlanOpen(false)}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
            aria-label="关闭"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 p-5">
          <Field label="日期">
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-[11px] text-slate-500">
                设置后会启用天气预报。
              </p>
              {date && city?.name && (
                <WeatherChip city={city.name} date={date} />
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="住宿名称">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={lodgingName}
                onChange={(e) => setLodgingName(e.target.value)}
                placeholder="例：西湖国宾馆"
              />
            </Field>
            <Field label="住宿地址">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={lodgingAddr}
                onChange={(e) => setLodgingAddr(e.target.value)}
                placeholder="例：杭州市西湖区杨公堤 18 号"
              />
            </Field>
          </div>

          <Field label="当日交通备注">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value)}
              placeholder="例：高铁、自驾、市内地铁"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              这是给自己看的备注。景点之间的导航在地图上用右键切换。
            </p>
          </Field>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="ghost"
              className="!text-[11px] text-red-600 hover:bg-red-50"
              onClick={() => {
                if (window.confirm(`确定删除第 ${day.dayIndex} 天吗?`)) {
                  deleteDay(day.id)
                  setDayPlanOpen(false)
                }
              }}
            >
              删除此天
            </Btn>
            <Btn
              variant="secondary"
              className="!text-[11px]"
              onClick={() => extendDaySpotsByAI(day.id)}
            >
              ✨ AI 补充景点
            </Btn>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setDayPlanOpen(false)}>
              取消
            </Btn>
            <Btn variant="primary" onClick={handleSave}>
              保存
            </Btn>
          </div>
        </footer>
      </div>
    </div>
  )
}
