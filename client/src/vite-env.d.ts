/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 高德 Web 端（JS API）Key — 仅地图 SDK */
  readonly VITE_AMAP_KEY: string
  /** 高德 Web 端 Key 若启用安全密钥，需与控制台一致 */
  readonly VITE_AMAP_SECURITY_CODE?: string
  /** 高德 Web 服务 Key — restapi（POI/路径/图片）；可省略，改在设置里填 */
  readonly VITE_AMAP_WEBSERVICE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
