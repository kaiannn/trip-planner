import { useCallback } from 'react'
import { useTripStore } from '../store'
import { Btn } from './ui'
import { Modal } from './layout/Modal'

/**
 * AI recommend dialog — Header button → centered modal
 * (same chrome family as Settings / Spot detail, not map overlay).
 */
export function AiSeedModal() {
  const aiSeedOpen = useTripStore((s) => s.aiSeedOpen)
  const setAiSeedOpen = useTripStore((s) => s.setAiSeedOpen)
  const aiSeedInput = useTripStore((s) => s.aiSeedInput)
  const aiSeedStatus = useTripStore((s) => s.aiSeedStatus)
  const tripType = useTripStore((s) => s.tripType)
  const setTripField = useTripStore((s) => s.setTripField)
  const setAiSeedInput = useTripStore((s) => s.setAiSeedInput)
  const seedPoolFromAi = useTripStore((s) => s.seedPoolFromAi)
  const seedPoolAroundWithFilter = useTripStore((s) => s.seedPoolAroundWithFilter)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const loadDemoData = useTripStore((s) => s.loadDemoData)
  const resetQuiz = useTripStore((s) => s.resetQuiz)
  const setTripWizardOpen = useTripStore((s) => s.setTripWizardOpen)

  const loading =
    aiSeedStatus.includes('正在') || aiSeedStatus.includes('定位坐标')
  const failed =
    !loading &&
    (aiSeedStatus.startsWith('生成失败') ||
      aiSeedStatus.includes('请求失败') ||
      aiSeedStatus.startsWith('第 '))

  const isEmpty =
    cities.length === 0 && spots.length === 0 && dailyPlans.length === 0

  const close = useCallback(() => setAiSeedOpen(false), [setAiSeedOpen])

  const handleRun = useCallback(() => {
    if (!loading) void seedPoolFromAi()
  }, [loading, seedPoolFromAi])

  const handleAround = useCallback(() => {
    if (!loading) void seedPoolAroundWithFilter()
  }, [loading, seedPoolAroundWithFilter])

  return (
    <Modal
      open={aiSeedOpen}
      onClose={close}
      label="AI 推荐景点"
      panelClassName="max-w-lg overflow-hidden"
    >
      <div className="w-full overflow-hidden rounded-none border-0 bg-white shadow-none">
        <header className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI 推荐景点</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              描述行程 → 生成候选 → 进入景点池
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
            aria-label="关闭"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 p-5">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
            行程描述
            <textarea
              rows={4}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              placeholder="例：杭州 4 天，和伴侣，喜欢安静的地方、好吃的小馆子。"
              value={aiSeedInput}
              onChange={(e) => setAiSeedInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleRun()
              }}
              disabled={loading}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="primary"
              className={loading ? 'opacity-60' : ''}
              onClick={handleRun}
            >
              {loading ? '生成中…' : failed ? '重试' : '生成候选'}
            </Btn>
            <Btn
              variant="secondary"
              className={loading ? 'opacity-60' : ''}
              onClick={handleAround}
              disabled={cities.length === 0}
              title="用高德周边检索真实 POI，再由 AI 粗筛入池（不编造景点名）"
            >
              周边精筛
            </Btn>
            <select
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              value={tripType}
              onChange={(e) => setTripField('tripType', e.target.value)}
              aria-label="出行类型"
            >
              <option value="">出行类型…</option>
              <option value="亲子">亲子</option>
              <option value="情侣">情侣</option>
              <option value="朋友">朋友结伴</option>
              <option value="独自">独自旅行</option>
              <option value="家庭">家庭出行</option>
            </select>
            {failed && <span className="text-[11px] text-red-600">上次失败</span>}
            <span className="ml-auto text-[11px] text-slate-400">Ctrl/⌘ + Enter</span>
          </div>

          {aiSeedStatus && (
            <p className={`text-[12px] ${failed ? 'text-red-600' : 'text-slate-500'}`}>
              {aiSeedStatus}
            </p>
          )}

          {isEmpty && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[12px] text-slate-600">
              <span className="text-slate-500">还没想好？</span>
              <button
                type="button"
                className="font-medium text-sky-700 hover:underline"
                onClick={() => {
                  resetQuiz()
                  setTripWizardOpen(true)
                  close()
                }}
              >
                目的地小测
              </button>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  className="font-medium text-sky-700 hover:underline"
                  onClick={() => loadDemoData()}
                >
                  加载示例数据
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
