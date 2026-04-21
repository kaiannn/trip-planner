import { useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { Btn, Field, inputClass } from '../ui'

export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen)
  const setOpen = useSettingsStore((s) => s.setSettingsOpen)
  const llmApiKey = useSettingsStore((s) => s.llmApiKey)
  const amapKey = useSettingsStore((s) => s.amapKey)
  const setLlmApiKey = useSettingsStore((s) => s.setLlmApiKey)
  const setAmapKey = useSettingsStore((s) => s.setAmapKey)
  const serverKeyStatus = useSettingsStore((s) => s.serverKeyStatus)

  const [localLlm, setLocalLlm] = useState(llmApiKey)
  const [localAmap, setLocalAmap] = useState(amapKey)

  if (open && localLlm !== llmApiKey && !localLlm) setLocalLlm(llmApiKey)
  if (open && localAmap !== amapKey && !localAmap) setLocalAmap(amapKey)

  if (!open) return null

  const llmOnServer = serverKeyStatus?.llm ?? false
  const amapOnServer = serverKeyStatus?.amap ?? false

  const handleSave = () => {
    setLlmApiKey(localLlm.trim())
    setAmapKey(localAmap.trim())
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-bold text-slate-900">API 设置</h2>
        <p className="mb-5 text-[12px] leading-relaxed text-slate-500">
          Key 仅保存在你的浏览器本地，不会上传到任何第三方服务。
          如果服务端已配置对应 Key，则会优先使用服务端配置。
        </p>

        <div className="space-y-4">
          <div>
            <Field label="LLM API Key（DeepSeek / OpenAI 兼容）">
              <div className="relative">
                <input
                  type="password"
                  className={inputClass}
                  value={localLlm}
                  onChange={(e) => setLocalLlm(e.target.value)}
                  placeholder={llmOnServer ? '服务端已配置，可留空' : 'sk-...'}
                />
                {llmOnServer && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                    服务端已配置
                  </span>
                )}
              </div>
            </Field>
          </div>

          <div>
            <Field label="高德 Web 服务 Key">
              <div className="relative">
                <input
                  type="password"
                  className={inputClass}
                  value={localAmap}
                  onChange={(e) => setLocalAmap(e.target.value)}
                  placeholder={amapOnServer ? '服务端已配置，可留空' : '你的高德 Key'}
                />
                {amapOnServer && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                    服务端已配置
                  </span>
                )}
              </div>
            </Field>
            <p className="mt-1 text-[11px] text-slate-400">
              高德开放平台 → 应用管理 → Key → 需开通「Web 服务」权限
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Btn>
          <Btn variant="primary" onClick={handleSave}>
            保存
          </Btn>
        </div>
      </div>
    </div>
  )
}
