/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AMAP_KEY: string
  /** 高德 Web 端 Key 若启用安全密钥，需与控制台一致 */
  readonly VITE_AMAP_SECURITY_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
