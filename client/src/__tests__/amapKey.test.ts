import { beforeEach, describe, expect, it } from 'vitest'
import { getAmapWebServiceKey, requireAmapWebServiceKey, seedWebServiceKeyFromEnv } from '../lib/amapKey'
import { useSettingsStore } from '../store/settingsStore'

describe('amapKey', () => {
  beforeEach(() => {
    useSettingsStore.setState({ amapWebServiceKey: '' })
  })

  it('prefers settings web service key over empty env', () => {
    useSettingsStore.setState({ amapWebServiceKey: 'from-settings' })
    expect(getAmapWebServiceKey()).toBe('from-settings')
  })

  it('require throws when no web service key', () => {
    expect(() => requireAmapWebServiceKey()).toThrow(/Web 服务/)
  })

  it('seed is a no-op when settings already has a key', () => {
    useSettingsStore.setState({ amapWebServiceKey: 'keep-me' })
    seedWebServiceKeyFromEnv()
    expect(useSettingsStore.getState().amapWebServiceKey).toBe('keep-me')
  })
})
