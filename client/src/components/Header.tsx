import { useTripStore } from '../store/tripStore'
import { useSettingsStore } from '../store/settingsStore'
import { Btn, Field, inputClass } from './ui'

export function Header() {
  const tripTitle = useTripStore((s) => s.tripTitle)
  const tripStart = useTripStore((s) => s.tripStart)
  const tripEnd = useTripStore((s) => s.tripEnd)
  const tripExpectation = useTripStore((s) => s.tripExpectation)
  const tripType = useTripStore((s) => s.tripType)
  const setTripField = useTripStore((s) => s.setTripField)
  const cities = useTripStore((s) => s.cities)
  const syncTripIntelligence = useTripStore((s) => s.syncTripIntelligence)
  const pushLog = useTripStore((s) => s.pushLog)
  const resetQuiz = useTripStore((s) => s.resetQuiz)
  const setTripWizardOpen = useTripStore((s) => s.setTripWizardOpen)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const needsUserKeys = useSettingsStore((s) => s.needsUserKeys)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 py-3 md:px-6">
        <h1 className="mb-3 text-lg font-bold tracking-tight text-slate-900 md:text-xl">旅游攻略行程规划</h1>
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 shadow-inner ring-1 ring-slate-900/[0.03]">
          <div className="flex flex-wrap items-end gap-2 md:gap-2.5">
            <Field label="行程标题">
              <input
                className={inputClass}
                value={tripTitle}
                onChange={(e) => setTripField('tripTitle', e.target.value)}
                placeholder="例如：日本关西亲子游"
              />
            </Field>
            <Field label="出发">
              <input
                type="date"
                className={inputClass}
                value={tripStart}
                onChange={(e) => setTripField('tripStart', e.target.value)}
              />
            </Field>
            <Field label="结束">
              <input
                type="date"
                className={inputClass}
                value={tripEnd}
                onChange={(e) => setTripField('tripEnd', e.target.value)}
              />
            </Field>
            <Field label="旅行期望（给 AI）" className="min-w-[200px] flex-1">
              <textarea
                rows={2}
                className={`${inputClass} min-h-[40px] resize-y`}
                value={tripExpectation}
                onChange={(e) => setTripField('tripExpectation', e.target.value)}
                placeholder="例如：少排队、想逛古建筑…"
              />
            </Field>
            <Field label="出行类型">
              <select className={inputClass} value={tripType} onChange={(e) => setTripField('tripType', e.target.value)}>
                <option value="">未指定</option>
                <option value="亲子">亲子</option>
                <option value="情侣">情侣</option>
                <option value="朋友">朋友结伴</option>
                <option value="独自">独自旅行</option>
                <option value="家庭">家庭出行</option>
              </select>
            </Field>
            <Btn
              variant="primary"
              onClick={() => {
                if (!cities.length) {
                  pushLog('请先添加至少一个城市。', 'error')
                  return
                }
                void syncTripIntelligence()
                document.getElementById('ai-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              智能同步
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => {
                resetQuiz()
                setTripWizardOpen(true)
              }}
            >
              目的地小测
            </Btn>
            <Btn
              variant="ghost"
              className="relative"
              onClick={() => setSettingsOpen(true)}
            >
              {needsUserKeys() && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
            </Btn>
          </div>
        </div>
      </div>
    </header>
  )
}
