import { useEffect, useMemo, useState } from 'react'
import { useTripStore } from '../../store'
import { DAY_COLORS } from '../../lib/spotKind'
import { formatDayLabel } from '../../lib/date'
import {
  BRANCH_PRESETS,
  formatPathPreview,
  hasBranches,
  resolveDaySpotOrder,
} from '../../lib/resolveDayPath'
import type { DailyPlan } from '../../types'
import { getSpotDragData, isSpotDrag } from '../../lib/dnd'
import { FloatingPanel } from '../layout/FloatingPanel'

type MenuState = { dayId: string; x: number; y: number } | null

/** DayChip fixed width — keep in sync with DayChip className w-[11.5rem] */
const DAY_CHIP_W = 184
const DAY_CHIP_GAP = 8
const DAY_CHIP_H = 80
const DAY_STRIP_PAD_Y = 16
const PANEL_CHROME_X = 28
const PANEL_HEADER_H = 56
const HINT_H = 28
const TREE_EXTRA_H = 240

function panelWidthForCols(cols: number, maxW: number, minW: number): number {
  const n = Math.max(1, cols)
  const w = n * DAY_CHIP_W + (n - 1) * DAY_CHIP_GAP + PANEL_CHROME_X
  return Math.min(maxW, Math.max(minW, w))
}

function fitDayTimelineSize(dayCount: number, showTree: boolean, hasHint: boolean) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const maxW = Math.floor(vw * 0.96)
  const minW = 320
  const n = Math.max(1, dayCount)

  // Prefer one row; if too many nodes, max two rows of chips wide.
  const oneRowW = n * DAY_CHIP_W + (n - 1) * DAY_CHIP_GAP + PANEL_CHROME_X
  const cols = oneRowW <= maxW ? n : Math.max(2, Math.ceil(n / 2))
  const defaultW = panelWidthForCols(cols, maxW, minW)

  const usable = defaultW - PANEL_CHROME_X + DAY_CHIP_GAP
  const perRow = Math.max(1, Math.floor(usable / (DAY_CHIP_W + DAY_CHIP_GAP)))
  const rows = Math.min(2, Math.max(1, Math.ceil(n / perRow)))

  const stripH = rows * DAY_CHIP_H + Math.max(0, rows - 1) * DAY_CHIP_GAP + DAY_STRIP_PAD_Y
  const contentH = stripH + (showTree ? TREE_EXTRA_H : 0) + (hasHint ? HINT_H : 0)
  // FloatingPanel size includes header chrome
  const totalH = PANEL_HEADER_H + contentH
  const defaultH = showTree
    ? Math.min(Math.floor(vh * 0.9), Math.max(totalH, PANEL_HEADER_H + stripH + TREE_EXTRA_H))
    : totalH

  return {
    defaultW,
    defaultH: Math.round(defaultH),
    minH: showTree ? PANEL_HEADER_H + stripH + 160 : PANEL_HEADER_H + Math.min(stripH, 96),
    maxWRatio: 0.96,
    maxHRatio: 0.92,
  }
}

/**
 * Day strip — same FloatingPanel chrome as the spot pool
 * (header drag, four-corner resize, localStorage size).
 * Width/height auto-fit day chips: 1 row, or at most 2 rows when many.
 */
export function DayTimeline() {
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const mapFocusDayId = useTripStore((s) => s.mapFocusDayId)
  const setMapFocusDayId = useTripStore((s) => s.setMapFocusDayId)
  const addDayBranch = useTripStore((s) => s.addDayBranch)
  const removeDayBranch = useTripStore((s) => s.removeDayBranch)
  const setActiveBranch = useTripStore((s) => s.setActiveBranch)
  const openDayPlanFor = useTripStore((s) => s.openDayPlanFor)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const dayPlanOpen = useTripStore((s) => s.dayPlanOpen)
  const dayPlanEditDayId = useTripStore((s) => s.dayPlanEditDayId)
  const assignSpotToActivePath = useTripStore((s) => s.assignSpotToActivePath)

  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [menu, setMenu] = useState<MenuState>(null)
  const [customWhen, setCustomWhen] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [addingFor, setAddingFor] = useState<string | null>(null)

  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  const spotName = useMemo(() => {
    const map = new Map(spots.map((s) => [s.id, s.name]))
    return (id: string) => map.get(id) ?? '？'
  }, [spots])

  const focusedDay = sortedDays.find((d) => d.id === mapFocusDayId) ?? null
  const showTree = Boolean(
    focusedDay &&
      expanded &&
      (hasBranches(focusedDay) || addingFor === focusedDay.id),
  )

  useEffect(() => {
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        setAddingFor(null)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (sortedDays.length === 0) return null

  const cityNameOf = (cityId: string) =>
    cities.find((c) => c.id === cityId)?.name ?? ''

  const branchCount = dailyPlans.reduce((n, d) => n + (d.dayBranches?.length ?? 0), 0)

  const hasHint = Boolean(focusedDay && !hasBranches(focusedDay))
  const fit = fitDayTimelineSize(sortedDays.length, showTree, hasHint)
  const autoFitKey = `${sortedDays.length}:${showTree ? 1 : 0}:${hasHint ? 1 : 0}`

  return (
    <>
      {menu && (
        <div
          className="fixed z-[3000] min-w-[148px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-sky-50"
            onClick={() => {
              setMapFocusDayId(menu.dayId)
              setExpanded(true)
              setMenu(null)
            }}
          >
            展开决策树
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-sky-50"
            onClick={() => {
              setAddingFor(menu.dayId)
              setMapFocusDayId(menu.dayId)
              setExpanded(true)
              setMenu(null)
            }}
          >
            添加状况…
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-sky-50"
            onClick={() => {
              openDayPlanFor(menu.dayId)
              setMenu(null)
            }}
          >
            编辑日程详情
          </button>
        </div>
      )}

      <FloatingPanel
        title="日程"
        subtitle={`${sortedDays.length} 天${branchCount ? ` · ${branchCount} 个状况` : ''} · 双击天整理 · 右键加状况`}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        defaultDock="bl"
        resetDockKey="days"
        sizeId="day-timeline-v3"
        resizable
        defaultW={fit.defaultW}
        defaultBodyHeight={fit.defaultH}
        minBodyHeight={fit.minH}
        minW={320}
        maxWRatio={fit.maxWRatio}
        maxHRatio={fit.maxHRatio}
        autoFitKey={autoFitKey}
        bodyClassName="!p-0"
        actions={
          focusedDay && hasBranches(focusedDay) ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:border-slate-400 hover:text-slate-900"
              title={expanded ? '收起决策树' : '展开决策树'}
            >
              {expanded ? '收起树' : '决策树'}
            </button>
          ) : null
        }
      >
        <div
          className="flex h-full min-h-0 flex-col"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-1 pt-2">
            {sortedDays.map((day, idx) => (
              <DayChip
                key={day.id}
                day={day}
                idx={idx}
                city={cityNameOf(day.cityId)}
                active={mapFocusDayId === day.id}
                onClick={() => setMapFocusDayId(mapFocusDayId === day.id ? null : day.id)}
                onDoubleClick={() => {
                  if (dayPlanOpen && dayPlanEditDayId === day.id) {
                    setDayPlanOpen(false)
                  } else {
                    openDayPlanFor(day.id)
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenu({ dayId: day.id, x: e.clientX, y: e.clientY })
                }}
                onDropSpot={(spotId) => {
                  assignSpotToActivePath(spotId, day.id)
                  setMapFocusDayId(day.id)
                }}
              />
            ))}
          </div>

          {showTree && focusedDay && (
            <div data-tree-body className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-700">
                  第 {focusedDay.dayIndex} 天 · 决策树
                </span>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-slate-400"
                  onClick={() => setAddingFor(focusedDay.id)}
                >
                  + 状况
                </button>
                <button
                  type="button"
                  className="text-[11px] text-slate-400 hover:text-slate-600"
                  onClick={() => openDayPlanFor(focusedDay.id)}
                >
                  详情
                </button>
              </div>
              <BranchTree
                day={focusedDay}
                nameOf={spotName}
                onSelect={(id) => setActiveBranch(focusedDay.id, id)}
                onRemove={(id) => removeDayBranch(focusedDay.id, id)}
              />
              {addingFor === focusedDay.id && (
                <AddBranchForm
                  presets={BRANCH_PRESETS}
                  customWhen={customWhen}
                  customLabel={customLabel}
                  onCustomWhen={setCustomWhen}
                  onCustomLabel={setCustomLabel}
                  onAdd={(when, label) => {
                    addDayBranch(focusedDay.id, when, label)
                    setCustomWhen('')
                    setCustomLabel('')
                    setAddingFor(null)
                  }}
                  onCancel={() => setAddingFor(null)}
                />
              )}
            </div>
          )}

          {focusedDay && !hasBranches(focusedDay) && (
            <p className="shrink-0 px-3 pb-2 text-[11px] text-slate-400">
              双击天可整理站点 · 右键添加「状况」分支 · 可从景点池拖入
            </p>
          )}
        </div>
      </FloatingPanel>
    </>
  )
}

function DayChip({
  day,
  idx,
  city,
  active,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDropSpot,
}: {
  day: DailyPlan
  idx: number
  city: string
  active: boolean
  onClick: () => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDropSpot: (spotId: string) => void
}) {
  const color = DAY_COLORS[idx % DAY_COLORS.length]
  const nBr = day.dayBranches?.length ?? 0
  const activeLabel =
    day.activeBranchId == null
      ? null
      : (day.dayBranches?.find((b) => b.id === day.activeBranchId)?.label ?? null)
  const nStops = resolveDaySpotOrder(day).length
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={(e) => {
        if (!isSpotDrag(e.dataTransfer)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!isSpotDrag(e.dataTransfer)) return
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        const id = getSpotDragData(e.dataTransfer)
        if (id) onDropSpot(id)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`group flex w-[11.5rem] shrink-0 cursor-pointer select-none flex-col items-stretch gap-1 rounded-xl border px-3 py-2 text-left transition ${
        dragOver
          ? 'border-sky-600 bg-sky-50'
          : active
            ? 'border-slate-800/80 bg-white shadow-sm'
            : 'border-slate-200/90 bg-white hover:border-slate-400/80'
      }`}
      title="左键聚焦 · 双击整理 · 右键菜单 · 可拖入景点"
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[12px] font-semibold text-slate-800">
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ background: color }}
          />
          D{day.dayIndex}
          {day.date && (
            <span className="ml-1 font-normal text-slate-500">{formatDayLabel(day.date)}</span>
          )}
        </span>
        {nBr > 0 && (
          <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">
            {nBr}状况
          </span>
        )}
      </div>
      {city && <div className="truncate text-[11px] text-slate-500">{city}</div>}
      <div className="truncate text-[10px] text-slate-400">
        {activeLabel ? `走「${activeLabel}」` : `${nStops} 站`}
        {active && (
          <span className="ml-1.5 text-[10px] font-medium text-slate-900">· 选中</span>
        )}
      </div>
    </div>
  )
}

function BranchTree({
  day,
  nameOf,
  onSelect,
  onRemove,
}: {
  day: DailyPlan
  nameOf: (id: string) => string
  onSelect: (id: string | null) => void
  onRemove: (id: string) => void
}) {
  const branches = day.dayBranches ?? []
  const activeId = day.activeBranchId ?? null
  const defaultActive = activeId == null

  return (
    <div className="space-y-1">
      <TreeRow
        indent={0}
        isLast={branches.length === 0}
        active={defaultActive}
        label="默认"
        preview={formatPathPreview(day.spotOrder, nameOf)}
        onSelect={() => onSelect(null)}
      />
      {branches.map((b, i) => (
        <TreeRow
          key={b.id}
          indent={1}
          isLast={i === branches.length - 1}
          active={activeId === b.id}
          label={b.label}
          preview={formatPathPreview(b.spotOrder, nameOf)}
          onSelect={() => onSelect(b.id)}
          onRemove={() => onRemove(b.id)}
        />
      ))}
    </div>
  )
}

function TreeRow({
  indent,
  isLast,
  active,
  label,
  preview,
  onSelect,
  onRemove,
}: {
  indent: number
  isLast: boolean
  active: boolean
  label: string
  preview: string
  onSelect: () => void
  onRemove?: () => void
}) {
  return (
    <div className="flex items-stretch gap-0">
      <div className="relative w-5 shrink-0" aria-hidden>
        {indent > 0 && <span className="absolute left-2 top-0 h-full w-px bg-slate-200" />}
        <span
          className={`absolute left-[7px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border ${
            active ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
          }`}
        />
        {!isLast && indent > 0 && (
          <span className="absolute bottom-0 left-2 h-1/2 w-px bg-slate-200" />
        )}
      </div>
      <div
        className={`mb-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
          active
            ? 'border-slate-800/70 bg-white shadow-sm'
            : 'border-slate-200/80 bg-white hover:border-slate-400/70'
        }`}
      >
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div
            className={`truncate text-[12px] font-medium ${active ? 'text-slate-900' : 'text-slate-800'}`}
          >
            {label}
            {active && (
              <span className="ml-1.5 rounded bg-slate-900 px-1 py-0.5 text-[9px] font-medium text-white">
                当前
              </span>
            )}
          </div>
          <div className="truncate text-[10px] text-slate-400">{preview}</div>
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-red-50 hover:text-red-500"
            aria-label="删除状况"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

function AddBranchForm({
  presets,
  customWhen,
  customLabel,
  onCustomWhen,
  onCustomLabel,
  onAdd,
  onCancel,
}: {
  presets: { when: string; label: string }[]
  customWhen: string
  customLabel: string
  onCustomWhen: (v: string) => void
  onCustomLabel: (v: string) => void
  onAdd: (when: string, label: string) => void
  onCancel: () => void
}) {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-2">
      <p className="mb-1.5 text-[11px] text-slate-500">选择状况（会从当前计划复制一份，再改）</p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.when}
            type="button"
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-400"
            onClick={() => onAdd(p.when, p.label)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <input
          className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
          placeholder="自定义键"
          value={customWhen}
          onChange={(e) => onCustomWhen(e.target.value)}
        />
        <input
          className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
          placeholder="显示名，如下大雨"
          value={customLabel}
          onChange={(e) => onCustomLabel(e.target.value)}
        />
        <button
          type="button"
          className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={!customWhen.trim() && !customLabel.trim()}
          onClick={() =>
            onAdd(
              customWhen.trim() || 'custom',
              customLabel.trim() || customWhen.trim() || '自定义',
            )
          }
        >
          添加
        </button>
        <button type="button" className="text-[11px] text-slate-400 hover:text-slate-600" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  )
}
