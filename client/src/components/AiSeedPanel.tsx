import { useTripStore } from '../store/tripStore'
import { Btn } from './ui'

/**
 * "Seed my spot pool with AI": a prominent, persistent block at the
 * top of the right rail. User describes their trip in natural
 * language, AI returns candidate spots, each is geocoded via AMap
 * and dropped into the pool. Replaces the old floating AiCard.
 */
export function AiSeedPanel() {
  const aiSeedInput = useTripStore((s) => s.aiSeedInput)
  const aiSeedStatus = useTripStore((s) => s.aiSeedStatus)
  const setAiSeedInput = useTripStore((s) => s.setAiSeedInput)
  const seedPoolFromAi = useTripStore((s) => s.seedPoolFromAi)

  const loading =
    aiSeedStatus.includes('正在') || aiSeedStatus.includes('定位坐标')

  return (
    <section className="shrink-0 rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/60 to-white p-3 shadow-sm ring-1 ring-teal-900/[0.03]">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm ${
            loading ? 'animate-pulse bg-teal-500' : 'bg-teal-600'
          }`}
        >
          AI
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-800">告诉我你想去哪</div>
          <div className="text-[11px] text-slate-500">
            我会把候选景点直接放进下面的池子，你来决定怎么安排
          </div>
        </div>
      </div>
      <textarea
        rows={3}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
        placeholder="例：杭州 4 天，和我伴侣，喜欢安静的地方、好吃的小馆子，想看一个标志性景点。"
        value={aiSeedInput}
        onChange={(e) => setAiSeedInput(e.target.value)}
        disabled={loading}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Btn
          variant="primary"
          className={loading ? 'opacity-60' : ''}
          onClick={() => {
            if (!loading) void seedPoolFromAi()
          }}
        >
          {loading ? '生成中…' : '帮我填景点池'}
        </Btn>
        {aiSeedStatus && (
          <span className="truncate text-[11px] text-slate-500">
            {aiSeedStatus}
          </span>
        )}
      </div>
    </section>
  )
}
