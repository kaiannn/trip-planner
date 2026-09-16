import { useSettingsStore } from '../store/settingsStore'

/**
 * Single source of truth for AMap keys.
 *
 * Two different key *types* on purpose — the console issues them separately:
 * - JS / Web 端: `VITE_AMAP_KEY` → webapi.amap.com (map SDK only)
 * - Web 服务: settings or `VITE_AMAP_WEBSERVICE_KEY` → restapi.amap.com
 *   (POI / routing / photos). Never fall back to the JS key — it returns
 *   USERKEY_PLAT_NOMATCH.
 */
export function getAmapJsKey(): string {
  return (import.meta.env.VITE_AMAP_KEY || '').trim()
}

export function getAmapSecurityCode(): string {
  return (import.meta.env.VITE_AMAP_SECURITY_CODE || '').trim()
}

export function getAmapWebServiceKey(): string {
  const fromSettings = (useSettingsStore.getState().amapWebServiceKey || '').trim()
  if (fromSettings) return fromSettings
  return (import.meta.env.VITE_AMAP_WEBSERVICE_KEY || '').trim()
}

export function requireAmapWebServiceKey(): string {
  const key = getAmapWebServiceKey()
  if (!key) {
    throw new Error(
      '未配置高德 Web 服务 Key：请在「设置」填写，或配置 VITE_AMAP_WEBSERVICE_KEY。注意：与地图 JS Key（VITE_AMAP_KEY）不是同一个。',
    )
  }
  return key
}

/** Seed settings from env once if the user has not saved a key yet. */
export function seedWebServiceKeyFromEnv() {
  const envKey = (import.meta.env.VITE_AMAP_WEBSERVICE_KEY || '').trim()
  if (!envKey) return
  const st = useSettingsStore.getState()
  if (!st.amapWebServiceKey?.trim()) st.setAmapWebServiceKey(envKey)
}
