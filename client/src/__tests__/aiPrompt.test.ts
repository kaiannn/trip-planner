import { describe, it, expect } from 'vitest'
import { buildAiPrompt, type TripContextPayload } from '../lib/aiPrompt'

const baseTrip: TripContextPayload = {
  title: '杭州之旅',
  startDate: '2025-04-01',
  endDate: '2025-04-03',
  travelExpectation: '喜欢安静的地方',
  tripType: '情侣',
  cities: [
    { id: 'c1', name: '杭州', order: 0, location: { lat: 30.25, lng: 120.15 } },
  ],
  spots: [
    {
      id: 's1',
      kind: 'sight',
      cityId: 'c1',
      name: '西湖',
      location: { lat: 30.25, lng: 120.15 },
      visitTimeText: '2-3小时',
    },
  ],
  dailyPlans: [
    {
      id: 'd1',
      dayIndex: 1,
      date: '2025-04-01',
      cityId: 'c1',
      lodging: { name: '某酒店' },
      spotOrder: ['s1'],
    },
  ],
}

describe('buildAiPrompt', () => {
  it('includes trip title and dates', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0 })
    expect(prompt).toContain('杭州之旅')
    expect(prompt).toContain('2025-04-01')
    expect(prompt).toContain('2025-04-03')
  })

  it('includes travel expectation', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0 })
    expect(prompt).toContain('喜欢安静的地方')
  })

  it('includes trip type', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0 })
    expect(prompt).toContain('情侣')
  })

  it('includes spot details', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0 })
    expect(prompt).toContain('西湖')
    expect(prompt).toContain('2-3小时')
  })

  it('includes lodging info', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0 })
    expect(prompt).toContain('某酒店')
  })

  it('includes budget when provided', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 500 })
    expect(prompt).toContain('500')
  })

  it('handles empty trip gracefully', () => {
    const emptyTrip: TripContextPayload = {
      title: '', startDate: '', endDate: '', travelExpectation: '', tripType: '',
      cities: [], spots: [], dailyPlans: [],
    }
    const prompt = buildAiPrompt({ trip: emptyTrip, focusCityId: '', budgetPerDay: 0 })
    expect(prompt).toContain('未填写')
  })

  it('adds focus restriction for spots-only', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0, focus: 'spots' })
    expect(prompt).toContain('只输出 type="spots"')
  })

  it('adds focus restriction for lodging-only', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0, focus: 'lodging' })
    expect(prompt).toContain('只输出 type="lodging"')
  })

  it('includes city coordinates', () => {
    const prompt = buildAiPrompt({ trip: baseTrip, focusCityId: 'c1', budgetPerDay: 0 })
    expect(prompt).toContain('30.25')
    expect(prompt).toContain('120.15')
  })
})
