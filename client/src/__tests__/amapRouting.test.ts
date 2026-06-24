import { describe, it, expect } from 'vitest'
import { TRANSPORT_LABEL, TRANSPORT_ICON, TRANSPORT_DASH } from '../lib/amapRouting'

describe('TRANSPORT_LABEL', () => {
  it('has labels for all four modes', () => {
    expect(TRANSPORT_LABEL.driving).toBeTruthy()
    expect(TRANSPORT_LABEL.walking).toBeTruthy()
    expect(TRANSPORT_LABEL.transit).toBeTruthy()
    expect(TRANSPORT_LABEL.riding).toBeTruthy()
  })
})

describe('TRANSPORT_ICON', () => {
  it('has icons for all four modes', () => {
    expect(TRANSPORT_ICON.driving).toBeTruthy()
    expect(TRANSPORT_ICON.walking).toBeTruthy()
    expect(TRANSPORT_ICON.transit).toBeTruthy()
    expect(TRANSPORT_ICON.riding).toBeTruthy()
  })
})

describe('TRANSPORT_DASH', () => {
  it('driving is solid', () => {
    expect(TRANSPORT_DASH.driving).toBe('solid')
  })

  it('non-driving modes are dashed', () => {
    expect(TRANSPORT_DASH.walking).toBe('dashed')
    expect(TRANSPORT_DASH.transit).toBe('dashed')
    expect(TRANSPORT_DASH.riding).toBe('dashed')
  })
})
