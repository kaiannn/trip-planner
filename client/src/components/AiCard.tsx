import { useState } from 'react'
import { useTripStore } from '../store/tripStore'
import type { AiItem, AiSection } from '../types'
import { Btn } from './ui'

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
    <div className="space-y-2 border-t border-slate-100 pt-2">
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

export function AiCard() {
  const aiStatus = useTripStore((s) => s.aiStatus)
  const aiPromptText = useTripStore((s) => s.aiPromptText)
  const aiSections = useTripStore((s) => s.aiSections)
  const applyAiSpotItem = useTripStore((s) => s.applyAiSpotItem)
  const applyAiLodgingItem = useTripStore((s) => s.applyAiLodgingItem)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const isLoading = useIsAiLoading()
  const showSkeleton = isLoading && aiSections.length === 0

  return (
    <div
      id="ai-card"
      className="pointer-events-auto absolute right-3 top-3 z-10 flex w-[min(340px,calc(100%-24px))] max-h-[min(52vh,480px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-md"
    >
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-teal-50/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm ${
              isLoading ? 'animate-pulse bg-teal-500' : 'bg-teal-600'
            }`}
          >
            AI
          </span>
          <span className="text-sm font-semibold text-slate-800">推荐</span>
          {isLoading && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
              流式生成中
            </span>
          )}
        </div>
      </div>
      <div className="max-h-[min(48vh,420px)] space-y-3 overflow-y-auto p-3 text-sm">
        <p className="text-xs leading-relaxed text-slate-600">{aiStatus}</p>
        <details className="group rounded-xl border border-slate-200/80 bg-slate-50/90">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-teal-800 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-teal-300/80 decoration-dotted underline-offset-2">
              查看发送给 AI 的 Prompt
            </span>
          </summary>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap border-t border-slate-100 bg-white/80 p-2 font-mono text-[10px] leading-relaxed text-slate-600">
            {aiPromptText}
          </pre>
        </details>
        {showSkeleton ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-2 border-t border-slate-100 pt-2">
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
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {sec.type || 'other'}
                  </span>
                </button>
                {open[i] && (
                  <div className="space-y-2 border-t border-slate-100 bg-slate-50/30 px-3 py-2">
                    {(sec.items || []).map((item: AiItem, j: number) => (
                      <div key={j} className="rounded-lg border border-slate-100 bg-white p-2.5 text-slate-700 shadow-sm">
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
    </div>
  )
}
