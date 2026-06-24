import { useEffect, useState, useCallback } from 'react'

export interface AmapScriptState {
  scriptReady: boolean
  mapLoadError: string | null
}

/**
 * Loads the AMap JS SDK and plugins. Returns script ready state and any error.
 */
export function useAmapScript(reportError: (msg: string) => void): AmapScriptState {
  const amapKey = import.meta.env.VITE_AMAP_KEY || 'YOUR_AMAP_KEY'
  const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE || ''
  const amapKeyMissing = amapKey === 'YOUR_AMAP_KEY' || !amapKey.trim()

  const [scriptReady, setScriptReady] = useState(() => !!window.AMap)
  const [mapLoadError, setMapLoadError] = useState<string | null>(() =>
    amapKeyMissing
      ? '未配置 VITE_AMAP_KEY：请在 client/.env 中填写高德「Web 端」Key 并重启 Vite。'
      : null,
  )

  const wrappedReport = useCallback(
    (msg: string) => {
      setMapLoadError(msg)
      reportError(msg)
    },
    [reportError],
  )

  useEffect(() => {
    if (amapKeyMissing) {
      reportError('未配置 VITE_AMAP_KEY：请在 client/.env 中填写高德「Web 端」Key 并重启 Vite。')
      return
    }

    if (amapSecurityCode) {
      window._AMapSecurityConfig = { securityJsCode: amapSecurityCode }
    } else if (import.meta.env.DEV) {
      console.info(
        '[Amap] 未设置 VITE_AMAP_SECURITY_CODE。若控制台为该 Key 启用了安全密钥，地图会失败，请在 client/.env 填写。',
      )
    }

    if (window.AMap) return

    const src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapKey)}&plugin=AMap.Geocoder,AMap.Driving,AMap.Walking,AMap.Transfer,AMap.Riding,AMap.AutoComplete,AMap.PlaceSearch,AMap.Weather`

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      if (!window.AMap) {
        wrappedReport('地图脚本已加载，但 window.AMap 不存在。多为 Key/安全密钥不匹配或控制台「服务平台」选错（须 Web 端 JS API）。')
        return
      }
      setScriptReady(true)
    }
    script.onerror = () => {
      wrappedReport('地图脚本请求失败（网络、广告拦截、公司代理或 HTTPS 混合内容）。请打开浏览器开发者工具 → Network 查看 webapi.amap.com 是否被拦截。')
    }
    document.body.appendChild(script)
    return () => {
      script.onload = null
      script.onerror = null
      script.remove()
    }
  }, [amapKey, amapKeyMissing, amapSecurityCode, reportError, wrappedReport])

  return { scriptReady, mapLoadError }
}
