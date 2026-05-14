import { useTripStore } from '../store/tripStore'
import { Btn } from './ui'

/**
 * "Seed my spot pool with AI": a prominent, persistent block at the
 * top of the right rail. User describes their trip in natural
 * language, AI returns candidate spots, each is geocoded via AMap
 * and dropped into the pool.
 *
 * This panel also serves as the home for trip-wide AI context that
 * used to live in the Header form row:
 *   - trip type (family / couple / etc.)
 *   - "目的地小测" quiz entry point
 *   - demo data shortcut (only shown when there's nothing else)
 *
 * Rationale: the header needs to stay clean; everything AI-related
 * belongs in one panel that's the obvious "talk to the AI" surface.
 */
export function AiSeedPanel() {
  const aiSeedInput = useTripStore((s) => s.aiSeedInput)
  const aiSeedStatus = useTripStore((s) => s.aiSeedStatus)
  const tripType = useTripStore((s) => s.tripType)
  const setTripField = useTripStore((s) => s.setTripField)
  const setAiSeedInput = useTripStore((s) => s.setAiSeedInput)
  const seedPoolFromAi = useTripStore((s) => s.seedPoolFromAi)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const loadDemoData = useTripStore((s) => s.loadDemoData)
  const resetQuiz = useTripStore((s) => s.resetQuiz)
  const setTripWizardOpen = useTripStore((s) => s.setTripWizardOpen)

  const loading =
    aiSeedStatus.includes('正在') || aiSeedStatus.includes('定位坐标')
  // Surface a manual retry CTA when the last attempt ended in error.
  const failed =
    !loading &&
    (aiSeedStatus.startsWith('生成失败') ||
      aiSeedStatus.includes('请求失败') ||
      aiSeedStatus.startsWith('第 ') /* "第 N 次失败:..." retry trace */)

  // "Empty" = user hasn't actually started a trip yet. Show the demo-data
  // shortcut and the quiz link only in this state so they don't clutter
  // the panel once the trip is underway.
  const isEmpty =
    cities.length === 0 && spots.length === 0 && dailyPlans.length === 0

  return (
    <section className="stone-1 shadow-stone shrink-0 border border-teal-200/60 bg-gradient-to-br from-teal-50 to-[#f1ebdf] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`stone-button flex h-8 w-8 items-center justify-center font-serif text-xs font-bold text-white shadow-stone-sm ${
            loading ? 'animate-pulse bg-teal-500' : 'bg-teal-600'
          }`}
        >
          AI
        </span>
        <div>
          <div className="font-serif text-[15px] font-semibold text-slate-800">
            告诉我你想去哪
          </div>
          <div className="text-[11px] text-slate-600">
            候选景点会进下面的池子 · AI 建议会一并生成
          </div>
        </div>
      </div>
      <textarea
        rows={3}
        className="w-full resize-y rounded-[18px_8px_16px_10px] border border-slate-200 bg-[#fdfaf3] px-3 py-2 text-[13px] leading-relaxed text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
        placeholder="例:杭州 4 天,和伴侣,喜欢安静的地方、好吃的小馆子,想看一个标志性景点。"
        value={aiSeedInput}
        onChange={(e) => setAiSeedInput(e.target.value)}
        disabled={loading}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Btn
          variant="primary"
          className={loading ? 'opacity-60' : ''}
          onClick={() => {
            if (!loading) void seedPoolFromAi()
          }}
        >
          {loading ? '生成中…' : failed ? '重试' : '帮我填景点池'}
        </Btn>
        <select
          className="rounded-md border border-slate-200/90 bg-[#fdfaf3] px-2.5 py-1.5 text-[12px] text-slate-700 shadow-inner transition focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/15"
          value={tripType}
          onChange={(e) => setTripField('tripType', e.target.value)}
          aria-label="出行类型"
          title="出行类型"
        >
          <option value="">出行类型…</option>
          <option value="亲子">亲子</option>
          <option value="情侣">情侣</option>
          <option value="朋友">朋友结伴</option>
          <option value="独自">独自旅行</option>
          <option value="家庭">家庭出行</option>
        </select>
        {failed && (
          <span className="text-[10px] text-red-600">⚠ 上次失败</span>
        )}
        {aiSeedStatus && (
          <span
            className={`ml-auto truncate text-[11px] ${
              failed ? 'text-red-700' : 'text-slate-600'
            }`}
          >
            {aiSeedStatus}
          </span>
        )}
      </div>
      {/* First-run shortcuts — visible only when the trip is truly empty.
          Keeping them here (and not in the header) avoids permanent
          button clutter while still giving a new user an obvious path in. */}
      {isEmpty && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-teal-200/60 pt-3 text-[11px] text-slate-600">
          <span className="text-slate-500">还没想好?</span>
          <button
            type="button"
            className="font-medium text-teal-700 transition hover:text-teal-800 hover:underline"
            onClick={() => {
              resetQuiz()
              setTripWizardOpen(true)
            }}
          >
            试试目的地小测 →
          </button>
          <button
            type="button"
            className="font-medium text-teal-700 transition hover:text-teal-800 hover:underline"
            onClick={() => loadDemoData()}
            title="一键加载杭州 3 天示例行程"
          >
            📦 加载示例数据
          </button>
        </div>
      )}
    </section>
  )
}
