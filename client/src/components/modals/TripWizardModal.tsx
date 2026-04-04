import { TRIP_QUIZ_TREE } from '../../constants/quiz'
import { buildTripProfileFromTags, suggestDestinationsFromProfile } from '../../lib/tripProfile'
import { useTripStore } from '../../store/tripStore'
import { Btn } from '../ui'

export function TripWizardModal() {
  const open = useTripStore((s) => s.tripWizardOpen)
  const setTripWizardOpen = useTripStore((s) => s.setTripWizardOpen)
  const quizNodeId = useTripStore((s) => s.quizNodeId)
  const quizPhase = useTripStore((s) => s.quizPhase)
  const tripQuizPath = useTripStore((s) => s.tripQuizPath)
  const tripQuizTags = useTripStore((s) => s.tripQuizTags)
  const selectQuizOption = useTripStore((s) => s.selectQuizOption)
  const quizGoPrev = useTripStore((s) => s.quizGoPrev)
  const quizBackFromResult = useTripStore((s) => s.quizBackFromResult)
  const appendExpectationFromQuiz = useTripStore((s) => s.appendExpectationFromQuiz)

  if (!open) return null

  const node = TRIP_QUIZ_TREE[quizNodeId]
  const profile = buildTripProfileFromTags(tripQuizTags)
  const progress = Math.min(tripQuizPath.length, 8)

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setTripWizardOpen(false)}
    >
      <div className="grid max-h-[90vh] w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white shadow-2xl md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3 p-5">
          <header className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <h2 className="text-lg font-bold text-slate-900">旅行性格小测验</h2>
            <Btn variant="secondary" onClick={() => setTripWizardOpen(false)}>
              退出
            </Btn>
          </header>
          {quizPhase === 'question' && node && (
            <>
              <p className="text-xs text-slate-500">
                第 {progress} / 8 题
              </p>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-base font-semibold text-slate-900 shadow-md">
                {node.question}
              </div>
              <div className="flex flex-col gap-2">
                {node.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectQuizOption(opt.tags, opt.next)}
                    className="flex w-full items-center justify-between rounded-full border border-slate-200 bg-white px-4 py-3 text-left text-sm transition hover:border-teal-400 hover:bg-teal-50"
                  >
                    <span className="font-medium text-slate-800">{opt.label}</span>
                    {opt.hint && <span className="text-xs text-slate-500">{opt.hint}</span>}
                  </button>
                ))}
              </div>
              <div>
                <Btn variant="secondary" className="!text-xs" onClick={() => quizGoPrev()}>
                  上一题
                </Btn>
              </div>
            </>
          )}
          {quizPhase === 'result' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-800">已完成全部问卷</p>
              <p className="text-sm text-slate-600">
                太棒了！你的旅行画像已生成，可在右侧预览。点击下方可将画像写入「旅行期望」。
              </p>
              <Btn variant="secondary" className="!text-xs" onClick={() => quizBackFromResult()}>
                上一题
              </Btn>
            </div>
          )}
        </div>
        <aside className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-900/5 p-5 md:border-l md:border-t-0">
          <h3 className="text-sm font-semibold text-slate-800">测验结果预览</h3>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            {profile ? `大致画像：${profile.summary}` : '完成题目后，这里会显示你的旅行画像。'}
          </div>
          <h3 className="text-sm font-semibold text-slate-800">可能适合你的旅行类型</h3>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {profile &&
              suggestDestinationsFromProfile(profile).map((s) => (
                <div key={s.name} className="rounded-xl border border-slate-100 bg-white p-3 text-xs">
                  <strong className="text-slate-900">{s.name}</strong>
                  <p className="mt-1 text-slate-600">{s.summary}</p>
                </div>
              ))}
          </div>
          <Btn variant="primary" className="mt-auto" onClick={() => appendExpectationFromQuiz()}>
            使用这个画像写入旅行期望
          </Btn>
        </aside>
      </div>
    </div>
  )
}
