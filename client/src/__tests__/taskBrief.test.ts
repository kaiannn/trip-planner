import { describe, it, expect } from 'vitest'
import {
  buildTaskBrief,
  formatBriefForPrompt,
  formatBriefLine,
  missingSlots,
  resolveDays,
  type TaskBriefSource,
} from '../lib/taskBrief'

const base: TaskBriefSource = {
  cityNames: [],
  tripStart: '',
  tripEnd: '',
  dailyPlanCount: 0,
  aiBudget: '',
  taskPace: '',
  taskInterests: [],
  taskDays: null,
}

describe('buildTaskBrief / missingSlots', () => {
  it('all slots missing on empty source', () => {
    const brief = buildTaskBrief(base)
    expect(brief.destination).toBeNull()
    expect(brief.days).toBeNull()
    expect(brief.budgetPerDay).toBeNull()
    expect(brief.pace).toBeNull()
    expect(brief.interestFocus).toEqual([])
    expect(missingSlots(brief)).toEqual([
      'destination',
      'days',
      'budget',
      'pace',
      'interest_focus',
    ])
  })

  it('fills destination from city list (multi-city arrow)', () => {
    const brief = buildTaskBrief({ ...base, cityNames: ['杭州', '绍兴'] })
    expect(brief.destination).toBe('杭州 → 绍兴')
    expect(missingSlots(brief)).not.toContain('destination')
  })

  it('parses budget, rejects zero and garbage', () => {
    expect(buildTaskBrief({ ...base, aiBudget: '500' }).budgetPerDay).toBe(500)
    expect(buildTaskBrief({ ...base, aiBudget: '0' }).budgetPerDay).toBeNull()
    expect(buildTaskBrief({ ...base, aiBudget: 'abc' }).budgetPerDay).toBeNull()
  })

  it('accepts only known pace values', () => {
    expect(buildTaskBrief({ ...base, taskPace: 'relaxed' }).pace).toBe('relaxed')
    expect(buildTaskBrief({ ...base, taskPace: 'sprint' }).pace).toBeNull()
  })

  it('filters blank interests', () => {
    const brief = buildTaskBrief({
      ...base,
      taskInterests: ['美食', '', '  ', '小众'],
    })
    expect(brief.interestFocus).toEqual(['美食', '小众'])
  })
})

describe('resolveDays priority', () => {
  it('daily plans win over dates and taskDays', () => {
    expect(
      resolveDays({
        ...base,
        dailyPlanCount: 4,
        tripStart: '2025-04-01',
        tripEnd: '2025-04-02',
        taskDays: 7,
      }),
    ).toBe(4)
  })

  it('date range used when no plans', () => {
    expect(
      resolveDays({
        ...base,
        tripStart: '2025-04-01',
        tripEnd: '2025-04-03',
        taskDays: 9,
      }),
    ).toBe(3)
  })

  it('explicit taskDays when dates and plans absent', () => {
    expect(resolveDays({ ...base, taskDays: 5 })).toBe(5)
    expect(resolveDays(base)).toBeNull()
    expect(resolveDays({ ...base, taskDays: -1 })).toBeNull()
  })
})

describe('formatters', () => {
  it('prompt block marks unknown fields', () => {
    const text = formatBriefForPrompt(buildTaskBrief(base))
    expect(text).toContain('任务简报')
    expect(text).toContain('未确定')
  })

  it('prompt block includes filled values', () => {
    const brief = buildTaskBrief({
      ...base,
      cityNames: ['成都'],
      dailyPlanCount: 3,
      aiBudget: '400',
      taskPace: 'relaxed',
      taskInterests: ['美食'],
    })
    const text = formatBriefForPrompt(brief)
    expect(text).toContain('成都')
    expect(text).toContain('3 天')
    expect(text).toContain('400 元')
    expect(text).toContain('松弛')
    expect(text).toContain('美食')
  })

  it('UI line is empty when brief empty', () => {
    expect(formatBriefLine(buildTaskBrief(base))).toBe('')
  })
})
