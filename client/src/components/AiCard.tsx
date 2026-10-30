import { useState } from 'react'
import { useTripStore } from '../store'
import type { AiItem, AiSection } from '../types'
import { Btn } from './ui'
import { FloatingPanel } from './layout/FloatingPanel'
import { TaskBriefBar } from './TaskBriefBar'

/** Is the AI currently working? Detected from the status string the store writes. */
function useIsAiLoading() {
  const status = useTripStore((s) => s.aiStatus)
  return (
    status.includes('正在') ||
    status.includes('生成中') ||
    status.includes('生成…') ||
    status.includes('将自动更新')
  )
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm ring-1 ring-slate-900/[0.03]"
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-10 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/40 px-3 py-2">
            <div className="h-2.5 w-full animate-pulse rounded bg-slate-200/70" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-200/70" />
            <div className="h-2.5 w-3/5 animate-pulse rounded bg-slate-200/60" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * AI recommendations — same FloatingPanel chrome as the spot pool.
 * Default dock: top-left (pool owns top-right; organizer takes top-right
 * when open, pool then moves left — AI shifts to bottom-right to stay clear).
 */
export function AiCard() {
  const aiStatus = useTripStore((s) => s.aiStatus)
  const aiPromptText = useTripStore((s) => s.aiPromptText)
  const aiSections = useTripStore((s) => s.aiSections)
  const aiDirty = useTripStore((s) => s.aiDirty)
  const dayPlanOpen = useTripStore((s) => s.dayPlanOpen)
  const requestAiRecommendations = useTripStore((s) => s.requestAiRecommendations)
  const applyAiSpotItem = useTripStore((s) => s.applyAiSpotItem)
  const applyAiLodgingItem = useTripStore((s) => s.applyAiLodgingItem)
  const hasCities = useTripStore((s) => s.cities.length > 0)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [collapsed, setCollapsed] = useState(false)
  const isLoading = useIsAiLoading()
  const showSkeleton = isLoading && aiSections.length === 0
  const canRefresh = !isLoading && hasCities

  const dirtyBadge = aiDirty && !isLoading && (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200/80">
      待刷新
    </span>
  )

  const subtitle = (
    <span className="inline-flex items-center gap-1.5">
      {isLoading ? (
        <span className="inline-flex items-center gap-1 text-teal-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
          生成中
        </span>
      ) : (
        aiStatus
      )}
      {dirtyBadge}
    </span>
  )

  return (
    <FloatingPanel
      title="AI 推荐"
      subtitle={subtitle}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      // Match spot pool sizing family; default top-left so it never stacks on pool (top-right).
      widthClassName="w-[19rem]"
      defaultDock={dayPlanOpen ? 'br' : 'tl'}
      resetDockKey={dayPlanOpen ? 'organizer' : 'map'}
      sizeId="ai-card-v1"
      resizable
      defaultBodyHeight={380}
      minBodyHeight={180}
      minW={240}
      maxWRatio={0.42}
      maxHRatio={0.72}
      bodyClassName="bg-white/40"
      actions={
        <>
          {isLoading ? null : (
            <button
              type="button"
              className="shrink-0 rounded border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation()
                void requestAiRecommendations('all')
              }}
              disabled={!canRefresh}
              title={
                aiDirty
                  ? '行程已变更，手动刷新推荐（会调用 LLM）'
                  : '重新生成推荐（会调用 LLM）'
              }
            >
              刷新
            </button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <TaskBriefBar />
        <details className="group rounded-xl border border-slate-200/80 bg-slate-50/90">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-teal-800 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-teal-300/80 decoration-dotted underline-offset-2">
              查看发送给 AI 的 Prompt
            </span>
          </summary>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap border-t border-slate-100 bg-white/80 p-2 font-mono text-[11px] leading-relaxed text-slate-600">
            {aiPromptText}
          </pre>
        </details>
        {showSkeleton ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-2">
            {aiSections.map((sec: AiSection, i: number) => (
              <div
                key={sec.id || i}
                className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm ring-1 ring-slate-900/[0.03]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-teal-50/40"
                  onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                >
                  <span className="font-semibold text-slate-800">{sec.title || '未命名'}</span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {sec.type || 'other'}
                  </span>
                </button>
                {open[i] && (
                  <div className="space-y-2 border-t border-slate-100 bg-slate-50/30 px-3 py-2">
                    {(sec.items || []).map((item: AiItem, j: number) => (
                      <div
                        key={j}
                        className="rounded-lg border border-slate-100 bg-white p-2.5 text-slate-700 shadow-sm"
                      >
                        <div className="font-medium">{item.title}</div>
                        {item.summary && (
                          <div className="text-[11px] text-slate-500">- {item.summary}</div>
                        )}
                        {(item.detail || item.meta) && (
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                            {item.detail || item.meta}
                          </p>
                        )}
                        <div className="mt-2 flex gap-2">
                          {sec.type === 'spots' && (
                            <Btn
                              variant="secondary"
                              className="!py-1 !text-xs"
                              onClick={() => applyAiSpotItem(item)}
                            >
                              加入景点
                            </Btn>
                          )}
                          {sec.type === 'lodging' && (
                            <Btn
                              variant="secondary"
                              className="!py-1 !text-xs"
                              onClick={() => applyAiLodgingItem(item)}
                            >
                              填入住宿
                            </Btn>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </FloatingPanel>
  )
}
