import { useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { Btn, Field, inputClass } from '../ui'

export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen)
  const setOpen = useSettingsStore((s) => s.setSettingsOpen)
  const llmApiKey = useSettingsStore((s) => s.llmApiKey)
  const llmBaseUrl = useSettingsStore((s) => s.llmBaseUrl)
  const llmModel = useSettingsStore((s) => s.llmModel)
  const amapWebServiceKey = useSettingsStore((s) => s.amapWebServiceKey)
  const setLlmApiKey = useSettingsStore((s) => s.setLlmApiKey)
  const setLlmBaseUrl = useSettingsStore((s) => s.setLlmBaseUrl)
  const setLlmModel = useSettingsStore((s) => s.setLlmModel)
  const setAmapWebServiceKey = useSettingsStore((s) => s.setAmapWebServiceKey)

  const [localLlm, setLocalLlm] = useState(llmApiKey)
  const [localBaseUrl, setLocalBaseUrl] = useState(llmBaseUrl)
  const [localModel, setLocalModel] = useState(llmModel)
  const [localAmap, setLocalAmap] = useState(amapWebServiceKey)

  if (!open) return null

  const handleSave = () => {
    setLlmApiKey(localLlm.trim())
    setLlmBaseUrl(localBaseUrl.trim())
    setLlmModel(localModel.trim())
    setAmapWebServiceKey(localAmap.trim())
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-bold text-slate-900">API 设置</h2>
        <p className="mb-5 text-[12px] leading-relaxed text-slate-500">
          所有 Key 仅保存在浏览器本地，不会上传到任何服务器。
        </p>

        <div className="space-y-4">
          <div>
            <Field label="LLM API Key（DeepSeek / OpenAI 兼容）">
              <input
                type="password"
                className={inputClass}
                value={localLlm}
                onChange={(e) => setLocalLlm(e.target.value)}
                placeholder="sk-..."
              />
            </Field>
          </div>

          <div>
            <Field label="LLM Base URL">
              <input
                type="text"
                className={inputClass}
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
              />
            </Field>
            <p className="mt-1 text-[11px] text-slate-400">
              DeepSeek / OpenAI / 任意兼容接口地址
            </p>
          </div>

          <div>
            <Field label="LLM 模型">
              <input
                type="text"
                className={inputClass}
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder="deepseek-chat"
              />
            </Field>
          </div>

          <div>
            <Field label="高德 Web 服务 Key">
              <input
                type="password"
                className={inputClass}
                value={localAmap}
                onChange={(e) => setLocalAmap(e.target.value)}
                placeholder="你的高德 Web 服务 Key"
              />
            </Field>
            <p className="mt-1 text-[11px] text-slate-400">
              高德开放平台 → 应用管理 → 创建应用 → 添加 Key → 服务平台选「Web 服务」
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
