import { useMemo, useState } from 'react'
import { useTripStore } from '../store'
import {
  INTEREST_OPTIONS,
  MISSING_SLOT_LABELS,
  PACE_OPTIONS,
  buildTaskBrief,
  formatBriefLine,
  missingSlots,
  type TaskPace,
} from '../lib/taskBrief'
import { inputClass } from './ui'

const DAY_CHOICES = [2, 3, 4, 5, 7]
const BUDGET_CHOICES = [200, 300, 500, 800]

/**
 * Structured constraint strip on the AI card: fill missing brief slots
 * with chips / tiny inputs — no LLM call.
 */
export function TaskBriefBar() {
  // Subscribe to stable references only — never map/slice inside the selector
  // (new array each time → useSyncExternalStore infinite re-render).
  const cities = useTripStore((s) => s.cities)
  const tripStart = useTripStore((s) => s.tripStart)
  const tripEnd = useTripStore((s) => s.tripEnd)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const aiBudget = useTripStore((s) => s.aiBudget)
  const taskPace = useTripStore((s) => s.taskPace)
  const taskInterests = useTripStore((s) => s.taskInterests)
  const taskDays = useTripStore((s) => s.taskDays)
  const setTaskPace = useTripStore((s) => s.setTaskPace)
  const toggleTaskInterest = useTripStore((s) => s.toggleTaskInterest)
  const setTaskDays = useTripStore((s) => s.setTaskDays)
  const setAiBudget = useTripStore((s) => s.setAiBudget)
  const [showAllInterests, setShowAllInterests] = useState(false)

  const cityNames = useMemo(
    () =>
      cities
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => c.name),
    [cities],
  )
  const dailyPlanCount = dailyPlans.length

  const brief = useMemo(
    () =>
      buildTaskBrief({
        cityNames,
        tripStart,
        tripEnd,
        dailyPlanCount,
        aiBudget,
        taskPace,
        taskInterests,
        taskDays,
      }),
    [cityNames, tripStart, tripEnd, dailyPlanCount, aiBudget, taskPace, taskInterests, taskDays],
  )
  const missing = useMemo(() => missingSlots(brief), [brief])

  const line = formatBriefLine(brief)
  const needDays = missing.includes('days')
  const needBudget = missing.includes('budget')
  const needPace = missing.includes('pace')
  const needInterest = missing.includes('interest_focus')
  const needDest = missing.includes('destination')
  // Interests/pace always shown so users can refine even when filled.
  const showDetail = needPace || needInterest || showAllInterests

  return (
    <div className="space-y-2 rounded-xl border border-slate-200/70 bg-slate-50/70 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            任务简报
          </div>
          <div className="truncate text-[12px] text-slate-700" title={line}>
            {line || '未填写 — 点击下方标签补齐（不调用 LLM）'}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded text-[11px] text-slate-400 hover:text-slate-600"
          onClick={() => setShowAllInterests((v) => !v)}
          title="展开/收起兴趣标签"
        >
          {showDetail ? '收起' : '编辑'}
        </button>
      </div>

      {needDest && (
        <MissingHint label={MISSING_SLOT_LABELS.destination} hint="请先添加城市" />
      )}

      {needDays && (
        <ChipRow label={MISSING_SLOT_LABELS.days}>
          {DAY_CHOICES.map((d) => (
            <button
              key={d}
              type="button"
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 hover:border-amber-400"
              onClick={() => {
                setTaskDays(d)
                // If start is known and end is missing, extend range so days resolve from dates too.
                if (tripStart && !tripEnd) {
                  const end = new Date(tripStart)
                  end.setDate(end.getDate() + d - 1)
                  useTripStore.getState().setTripField('tripEnd', end.toISOString().slice(0, 10))
                }
              }}
            >
              {d} 天
            </button>
          ))}
        </ChipRow>
      )}

      {needBudget && (
        <ChipRow label={MISSING_SLOT_LABELS.budget}>
          {BUDGET_CHOICES.map((b) => (
            <button
              key={b}
              type="button"
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 hover:border-amber-400"
              onClick={() => setAiBudget(String(b))}
            >
              ¥{b}
            </button>
          ))}
          <input
            type="number"
            min={0}
            step={50}
            placeholder="自定义"
            aria-label="每日预算"
            className={`${inputClass} !w-20 !py-0.5 !text-[11px]`}
            value={aiBudget}
            onChange={(e) => setAiBudget(e.target.value)}
          />
        </ChipRow>
      )}

      {(showDetail || needPace) && (
        <ChipRow label={MISSING_SLOT_LABELS.pace}>
          {PACE_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                brief.pace === p.value
                  ? 'border-teal-400 bg-teal-50 text-teal-800'
                  : needPace
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
              onClick={() => setTaskPace(brief.pace === p.value ? '' : (p.value as TaskPace))}
            >
              {p.label}
            </button>
          ))}
        </ChipRow>
      )}

      {(showDetail || needInterest) && (
        <ChipRow label={MISSING_SLOT_LABELS.interest_focus}>
          {INTEREST_OPTIONS.map((tag) => {
            const active = brief.interestFocus.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                  active
                    ? 'border-teal-400 bg-teal-50 text-teal-800'
                    : needInterest
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
                onClick={() => toggleTaskInterest(tag)}
              >
                {tag}
              </button>
            )
          })}
        </ChipRow>
      )}

      {dailyPlanCount === 0 && !needDays && (
        <p className="text-[10px] text-slate-400">
          天数来自日期范围；也可清除日期后用「天数」标签指定。
        </p>
      )}
    </div>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-8 shrink-0 text-[11px] font-medium text-slate-500">{label}</span>
      {children}
    </div>
  )
}

function MissingHint({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-8 shrink-0 text-[11px] font-medium text-slate-500">{label}</span>
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
        {hint}
      </span>
    </div>
  )
}
