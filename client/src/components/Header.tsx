import { useTripStore } from '../store'
import { useSettingsStore } from '../store/settingsStore'
import { shortDate } from '../lib/date'

/**
 * Stripped-back top bar. Holds only:
 *   - app heading (旅程攻略)
 *   - inline trip title input
 *   - date range pill (click left half = start, right half = end)
 *   - settings gear (single icon, no text)
 *
 * Everything AI-related (expectation textarea, trip type, sync, quiz,
 * demo data) lives in AiSeedPanel now. The previous header had 5 buttons
 * crammed into a form row; this one is a single line.
 */
export function Header() {
  const tripTitle = useTripStore((s) => s.tripTitle)
  const tripStart = useTripStore((s) => s.tripStart)
  const tripEnd = useTripStore((s) => s.tripEnd)
  const setTripField = useTripStore((s) => s.setTripField)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const llmApiKey = useSettingsStore((s) => s.llmApiKey)

  // Human-readable date range shown next to the title. Empty string if the
  // user hasn't set dates yet; we don't want to render a stray " – " dash.
  const range =
    tripStart && tripEnd
      ? `${shortDate(tripStart)} – ${shortDate(tripEnd)}`
      : tripStart
        ? shortDate(tripStart)
        : tripEnd
          ? shortDate(tripEnd)
          : ''

  return (
    <header className="sticky top-0 z-40 border-b border-slate-300/50 bg-[#ede3cf]/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            旅程攻略
          </h1>
          <input
            className="min-w-[160px] flex-1 border-0 bg-transparent p-0 text-[14px] font-medium text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-0 md:max-w-[420px] md:text-[15px]"
            value={tripTitle}
            onChange={(e) => setTripField('tripTitle', e.target.value)}
            placeholder="给这次行程起个名字…"
            aria-label="行程标题"
          />
          {/* Date range pill. Invisible native inputs sit on top of the
              visible labels so clicking the text opens the OS date picker
              without us shipping a date-picker library. Two inputs (start
              + end) share the pill; each takes half of the click area. */}
          <label
            className="group relative inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-2.5 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-800"
            title="点击设定行程日期"
          >
            <span className="pointer-events-none">
              {range || '设定日期'}
            </span>
            <input
              type="date"
              className="absolute left-0 top-0 h-full w-1/2 cursor-pointer opacity-0"
              value={tripStart}
              onChange={(e) => setTripField('tripStart', e.target.value)}
              aria-label="出发日期"
            />
            <input
              type="date"
              className="absolute right-0 top-0 h-full w-1/2 cursor-pointer opacity-0"
              value={tripEnd}
              onChange={(e) => setTripField('tripEnd', e.target.value)}
              aria-label="结束日期"
            />
          </label>
          {/* Settings — small icon-only affordance. Red dot indicates the
              user needs to fill in API keys before AI features will work. */}
          <button
            type="button"
            className="relative ml-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800"
            onClick={() => setSettingsOpen(true)}
            title="设置"
            aria-label="设置"
          >
            {!llmApiKey && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            )}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
