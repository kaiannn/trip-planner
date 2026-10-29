export function MapErrorOverlay({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 z-[5] flex flex-col justify-center gap-3 overflow-auto bg-amber-50/95 p-6 text-left text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200">
      <div className="max-w-lg">
        <p className="text-base font-semibold">地图没有加载成功</p>
        <p className="mt-2 text-amber-900/90">
          多半是高德 Key 没配好。打开右上角<strong className="font-medium">设置</strong>
          ，确认已填写「Web 端」Key 和安全密钥；本地开发还要检查
          <code className="mx-1 rounded bg-amber-100 px-1 font-mono text-[12px]">client/.env</code>
          ，改完后重启开发服务。
        </p>
        <p className="mt-2 text-[13px] text-amber-800/90">
          Key 需要在高德控制台里放行当前访问来源（如 localhost）。
        </p>
      </div>

      <details className="max-w-lg rounded-lg border border-amber-200/80 bg-white/50 p-3">
        <summary className="cursor-pointer text-[13px] font-medium text-amber-900">
          高级排查（开发者）
        </summary>
        <p className="mt-2 whitespace-pre-wrap font-mono text-[12px] text-amber-950/90">
          {error}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-amber-900/90">
          <li>浏览器开发者工具 Console / Network 里是否有高德报错（如 INVALID_USER_KEY、USERKEY_PLAT_NOMATCH）</li>
          <li>
            Web 端 Key 须与 <code className="font-mono">VITE_AMAP_KEY</code> 一致；启用安全密钥时需配置{' '}
            <code className="font-mono">VITE_AMAP_SECURITY_CODE</code>
          </li>
          <li>
            修改 <code className="font-mono">client/.env</code> 后必须重启 <code className="font-mono">npm run dev</code>
          </li>
        </ul>
      </details>
    </div>
  )
}
