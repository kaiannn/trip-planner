import { useEffect, useMemo, useState } from 'react'
import { PlaceAutoComplete, type PlaceAutoCompleteValue } from '../components/PlaceAutoComplete'
import { Btn, Field, inputClass } from '../components/ui'
import { useSettingsStore } from '../store/settingsStore'
import { CyclingMap } from './CyclingMap'
import {
  addMinutesToTime,
  buildCyclingMarkdown,
  clampAvgSpeed,
  estimateDurationSec,
  formatDuration,
  formatKm,
  hasLocatedEndpoints,
  resolveSpeedDraft,
} from './routeMath'
import { SUPPLY_SEARCH_PRESETS } from './amapCycling'
import { snapshotRouteBook, useCyclingStore } from './store'
import {
  CYCLING_STOP_KIND_ICON,
  CYCLING_STOP_KIND_LABEL,
  type CyclingStopKind,
} from './types'

const ALL_KINDS = Object.keys(CYCLING_STOP_KIND_LABEL) as CyclingStopKind[]

export function CyclingRouteBookModal() {
  const open = useCyclingStore((s) => s.open)
  const setOpen = useCyclingStore((s) => s.setOpen)
  const title = useCyclingStore((s) => s.title)
  const setTitle = useCyclingStore((s) => s.setTitle)
  const stops = useCyclingStore((s) => s.stops)
  const segments = useCyclingStore((s) => s.segments)
  const totalDistance = useCyclingStore((s) => s.totalDistance)
  const totalDurationSec = useCyclingStore((s) => s.totalDurationSec)
  const avgSpeedKmh = useCyclingStore((s) => s.avgSpeedKmh)
  const departTime = useCyclingStore((s) => s.departTime)
  const notes = useCyclingStore((s) => s.notes)
  const setField = useCyclingStore((s) => s.setField)
  const planning = useCyclingStore((s) => s.planning)
  const planError = useCyclingStore((s) => s.planError)
  const statusMsg = useCyclingStore((s) => s.statusMsg)
  const addStop = useCyclingStore((s) => s.addStop)
  const updateStop = useCyclingStore((s) => s.updateStop)
  const removeStop = useCyclingStore((s) => s.removeStop)
  const moveStop = useCyclingStore((s) => s.moveStop)
  const setStopKind = useCyclingStore((s) => s.setStopKind)
  const planRoute = useCyclingStore((s) => s.planRoute)
  const resetRouteBook = useCyclingStore((s) => s.resetRouteBook)
  const openNearby = useCyclingStore((s) => s.openNearby)
  const closeNearby = useCyclingStore((s) => s.closeNearby)
  const nearbyAnchorStopId = useCyclingStore((s) => s.nearbyAnchorStopId)
  const nearbyKind = useCyclingStore((s) => s.nearbyKind)
  const nearbyKeywords = useCyclingStore((s) => s.nearbyKeywords)
  const setNearbyKeywords = useCyclingStore((s) => s.setNearbyKeywords)
  const nearbyLoading = useCyclingStore((s) => s.nearbyLoading)
  const nearbyError = useCyclingStore((s) => s.nearbyError)
  const nearbyResults = useCyclingStore((s) => s.nearbyResults)
  const searchNearby = useCyclingStore((s) => s.searchNearby)
  const addNearbyAsStop = useCyclingStore((s) => s.addNearbyAsStop)
  const ensureStartEnd = useCyclingStore((s) => s.ensureStartEnd)

  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const amapKey = useSettingsStore((s) => s.amapWebServiceKey)

  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle')
  // Draft string for the speed input — clamp only on blur/Enter so keyboard typing works.
  const [speedDraft, setSpeedDraft] = useState('')
  const [speedFocused, setSpeedFocused] = useState(false)

  useEffect(() => {
    if (!speedFocused) setSpeedDraft(String(avgSpeedKmh))
  }, [avgSpeedKmh, speedFocused])

  const speedForEst = resolveSpeedDraft(speedFocused ? speedDraft : '', avgSpeedKmh)

  const commitSpeed = () => {
    const next = clampAvgSpeed(resolveSpeedDraft(speedDraft, avgSpeedKmh))
    setField('avgSpeedKmh', next)
    setSpeedDraft(String(next))
    setSpeedFocused(false)
  }

  const estSec = useMemo(
    () => estimateDurationSec(totalDistance, speedForEst),
    [totalDistance, speedForEst],
  )
  const arriveAt = useMemo(
    () => addMinutesToTime(departTime, estSec / 60),
    [departTime, estSec],
  )

  if (!open) return null

  const canPlan = hasLocatedEndpoints(stops) && !planning

  const handlePick = (stopId: string, v: PlaceAutoCompleteValue) => {
    updateStop(stopId, {
      name: v.name || '未命名',
      address: v.address,
      location:
        v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : undefined,
      amapPoiId: v.poiId,
    })
  }

  const handleCopy = async () => {
    const md = buildCyclingMarkdown(snapshotRouteBook())
    try {
      await navigator.clipboard.writeText(md)
      setCopyState('ok')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      setCopyState('fail')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#f3ecdc]/98 backdrop-blur-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-300/50 bg-[#ede3cf] px-4 py-2.5 shadow-sm">
        <h2 className="font-serif text-[15px] font-bold text-slate-900">骑行路书</h2>
        <input
          className={`${inputClass} !w-auto min-w-[140px] max-w-[220px] flex-1`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="路书标题"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Btn onClick={handleCopy} disabled={!stops.length} title="复制 Markdown">
            {copyState === 'ok' ? '已复制' : copyState === 'fail' ? '复制失败' : '导出 MD'}
          </Btn>
          <Btn onClick={() => void planRoute()} disabled={!canPlan} variant="primary">
            {planning ? '规划中…' : '规划路线'}
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              if (confirm('清空当前路书？')) resetRouteBook()
            }}
          >
            重置
          </Btn>
          <Btn onClick={() => setOpen(false)}>关闭</Btn>
        </div>
      </header>

      {!amapKey && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
          需要高德「Web 服务 Key」才能规划与周边搜索。{' '}
          <button
            type="button"
            className="underline"
            onClick={() => setSettingsOpen(true)}
          >
            打开设置
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {/* Left: stops */}
        <aside className="flex w-full flex-col gap-3 overflow-auto lg:w-[360px] lg:shrink-0">
          <section className="rounded-xl border border-slate-200/80 bg-[#f8f2e4] p-3">
            <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 font-serif text-[13px] font-semibold text-slate-800">
              汇总
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-slate-700">
              <div>
                总里程
                <div className="font-semibold tabular-nums">{formatKm(totalDistance)}</div>
              </div>
              <div>
                高德预估
                <div className="font-semibold tabular-nums">
                  {formatDuration(totalDurationSec)}
                </div>
              </div>
              <div>
                均速估算
                <div className="font-semibold tabular-nums">{formatDuration(estSec)}</div>
              </div>
              <div>
                到达约
                <div className="font-semibold tabular-nums">{arriveAt}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="均速 km/h">
                <input
                  type="number"
                  min={5}
                  max={40}
                  step={0.5}
                  className={inputClass}
                  value={speedFocused ? speedDraft : avgSpeedKmh}
                  onChange={(e) => setSpeedDraft(e.target.value)}
                  onFocus={() => {
                    setSpeedFocused(true)
                    setSpeedDraft(String(avgSpeedKmh))
                  }}
                  onBlur={commitSpeed}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
              </Field>
              <Field label="出发时刻">
                <input
                  type="time"
                  className={inputClass}
                  value={departTime}
                  onChange={(e) => setField('departTime', e.target.value)}
                />
              </Field>
            </div>
            <Field label="备注" className="mt-2">
              <textarea
                className={`${inputClass} min-h-[56px]`}
                value={notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="路线说明、装备提醒…"
              />
            </Field>
          </section>

          {statusMsg && (
            <p className="text-[12px] text-teal-700">{statusMsg}</p>
          )}
          {planError && (
            <p className="text-[12px] text-red-600">{planError}</p>
          )}

          <section className="rounded-xl border border-slate-200/80 bg-[#f8f2e4] p-3">
            <div className="mb-2 flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <h3 className="font-serif text-[13px] font-semibold text-slate-800">
                节点（{stops.length}）
              </h3>
              <Btn
                onClick={() => {
                  ensureStartEnd()
                  addStop({ kind: 'checkpoint', name: '途经点' })
                }}
              >
                + 途经
              </Btn>
            </div>
            <ul className="space-y-2">
              {stops.map((stop, i) => (
                <li
                  key={stop.id}
                  className="rounded-lg border border-slate-200/80 bg-white/60 p-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[16px]" aria-hidden>
                      {CYCLING_STOP_KIND_ICON[stop.kind]}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          className={`${inputClass} !w-auto !py-1 text-[11px]`}
                          value={stop.kind}
                          disabled={stop.kind === 'start' || stop.kind === 'end'}
                          onChange={(e) =>
                            setStopKind(stop.id, e.target.value as CyclingStopKind)
                          }
                          aria-label="节点类型"
                        >
                          {ALL_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {CYCLING_STOP_KIND_LABEL[k]}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-400">#{i + 1}</span>
                      </div>
                      <PlaceAutoComplete
                        value={stop.name}
                        onChange={(name) => updateStop(stop.id, { name })}
                        onPick={(v) => handlePick(stop.id, v)}
                        placeholder="搜索并选择地点…"
                      />
                      {stop.location && (
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          {stop.location.lat.toFixed(5)}, {stop.location.lng.toFixed(5)}
                          {stop.address ? ` · ${stop.address}` : ''}
                        </p>
                      )}
                      <input
                        className={`${inputClass} !py-1`}
                        value={stop.note || ''}
                        placeholder="备注"
                        onChange={(e) => updateStop(stop.id, { note: e.target.value })}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {stop.location && (
                        <Btn
                          className="!px-1.5 !py-0.5 !text-[11px]"
                          onClick={() => openNearby(stop.id)}
                          title="周边搜索"
                        >
                          周边
                        </Btn>
                      )}
                      {stop.kind !== 'start' && stop.kind !== 'end' && (
                        <>
                          <Btn
                            className="!px-1.5 !py-0.5 !text-[11px]"
                            onClick={() => moveStop(stop.id, -1)}
                            title="上移"
                          >
                            ↑
                          </Btn>
                          <Btn
                            className="!px-1.5 !py-0.5 !text-[11px]"
                            onClick={() => moveStop(stop.id, 1)}
                            title="下移"
                          >
                            ↓
                          </Btn>
                          <Btn
                            className="!px-1.5 !py-0.5 !text-[11px]"
                            onClick={() => removeStop(stop.id)}
                            title="删除"
                          >
                            ✕
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {segments.length > 0 && (
            <section className="rounded-xl border border-slate-200/80 bg-[#f8f2e4] p-3">
              <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 font-serif text-[13px] font-semibold text-slate-800">
                分段
              </h3>
              <ul className="space-y-1 text-[12px] text-slate-700">
                {segments.map((seg) => {
                  const from = stops.find((s) => s.id === seg.fromId)?.name ?? '?'
                  const to = stops.find((s) => s.id === seg.toId)?.name ?? '?'
                  return (
                    <li
                      key={`${seg.fromId}-${seg.toId}`}
                      className="flex justify-between gap-2 border-b border-slate-100 pb-1 last:border-0"
                    >
                      <span className="truncate">
                        {from} → {to}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {formatKm(seg.distance)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </aside>

        {/* Right: map + nearby */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <CyclingMap className="min-h-[280px] flex-1 lg:min-h-0" />

          {nearbyAnchorStopId && (
            <section className="rounded-xl border border-teal-200 bg-white/90 p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-[13px] font-semibold text-slate-800">
                  周边搜索
                </h3>
                <div className="flex flex-wrap gap-1">
                  {SUPPLY_SEARCH_PRESETS.map((p) => (
                    <button
                      key={p.kind}
                      type="button"
                      onClick={() => {
                        const anchor = stops.find((s) => s.id === nearbyAnchorStopId)
                        if (anchor) openNearby(anchor.id, p.kind)
                      }}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        nearbyKind === p.kind
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  className={`${inputClass} !w-auto min-w-[120px] flex-1`}
                  value={nearbyKeywords}
                  onChange={(e) => setNearbyKeywords(e.target.value)}
                  placeholder="关键词"
                />
                <Btn variant="primary" onClick={() => void searchNearby()} disabled={nearbyLoading}>
                  {nearbyLoading ? '搜索中…' : '搜索'}
                </Btn>
                <Btn variant="ghost" onClick={closeNearby}>
                  收起
                </Btn>
              </div>
              {nearbyError && <p className="text-[12px] text-red-600">{nearbyError}</p>}
              {nearbyResults.length > 0 && (
                <ul className="max-h-36 space-y-1 overflow-auto">
                  {nearbyResults.map((poi) => (
                    <li
                      key={poi.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[12px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{poi.name}</div>
                        {poi.address && (
                          <div className="truncate text-[11px] text-slate-500">{poi.address}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {poi.distance != null && (
                          <span className="tabular-nums text-slate-400">
                            {formatKm(poi.distance)}
                          </span>
                        )}
                        <Btn
                          className="!py-1 !text-[11px]"
                          onClick={() => addNearbyAsStop(poi)}
                        >
                          加入
                        </Btn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!nearbyLoading && nearbyResults.length === 0 && !nearbyError && (
                <p className="text-[12px] text-slate-500">点击「搜索」查找附近 POI</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                加入后会插入到锚点之后，记得再点「规划路线」刷新里程。
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
