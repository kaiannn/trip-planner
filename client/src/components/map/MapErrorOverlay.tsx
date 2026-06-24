export function MapErrorOverlay({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 z-[5] flex flex-col justify-center gap-2 overflow-auto bg-amber-50/95 p-4 text-left text-xs leading-relaxed text-amber-950 ring-1 ring-amber-200">
      <p className="font-semibold">地图未就绪</p>
      <p className="whitespace-pre-wrap">{error}</p>
      <p className="text-amber-800/90">
        排查:① 浏览器 F12 → Console / Network 是否有高德报错(如 INVALID_USER_KEY、USERKEY_PLAT_NOMATCH)②
        控制台 Key 须为「Web 端」,且与 VITE_AMAP_KEY 一致;启用安全密钥时须配置 VITE_AMAP_SECURITY_CODE ③
        Key 安全设置里放行访问来源(如 localhost、127.0.0.1)④ 修改 client/.env 后必须重启 npm run dev
      </p>
    </div>
  )
}
