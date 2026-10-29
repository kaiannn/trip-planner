import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useTripStore } from '../../store'
import { exportTripJson } from '../../lib/tripExport'
import { Btn, Field, inputClass } from '../ui'
import { Modal } from '../layout/Modal'

/** AMap keys are alphanumeric; strip paste/IME junk (full-width, zero-width, spaces). */
function sanitizeAmapKey(raw: string): string {
  return raw
    .normalize('NFKC')
    // control chars, zero-width, BOM, whitespace
    // eslint-disable-next-line no-control-regex -- intentional strip of paste junk
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\uFEFF\s]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
}

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
  const clearTrip = useTripStore((s) => s.clearTrip)

  const [localLlm, setLocalLlm] = useState(llmApiKey)
  const [localBaseUrl, setLocalBaseUrl] = useState(llmBaseUrl)
  const [localModel, setLocalModel] = useState(llmModel)
  const [localAmap, setLocalAmap] = useState(amapWebServiceKey)
  const [showAmap, setShowAmap] = useState(false)

  // Re-sync draft fields each time the modal opens (store may have been
  // seeded from env or another code path while the modal was closed).
  useEffect(() => {
    if (!open) return
    setLocalLlm(llmApiKey)
    setLocalBaseUrl(llmBaseUrl)
    setLocalModel(llmModel)
    setLocalAmap(amapWebServiceKey)
    setShowAmap(false)
  }, [open, llmApiKey, llmBaseUrl, llmModel, amapWebServiceKey])

  const handleSave = () => {
    setLlmApiKey(localLlm.trim())
    setLlmBaseUrl(localBaseUrl.trim())
    setLlmModel(localModel.trim())
    setAmapWebServiceKey(sanitizeAmapKey(localAmap))
    setOpen(false)
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} label="API 设置" panelClassName="max-w-md p-6">
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
              autoComplete="off"
              spellCheck={false}
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
              autoComplete="off"
              spellCheck={false}
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
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>

        <div>
          <Field label="高德 Web 服务 Key（POI / 路径 / 图片）">
            <div className="relative">
              <input
                type={showAmap ? 'text' : 'password'}
                className={`${inputClass} pr-16 font-mono`}
                value={localAmap}
                onChange={(e) => setLocalAmap(e.target.value)}
                placeholder="你的高德 Web 服务 Key"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowAmap((v) => !v)}
              >
                {showAmap ? '隐藏' : '显示'}
              </button>
            </div>
          </Field>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            高德控制台 → 应用 → 添加 Key → 服务平台选「<strong className="font-medium text-slate-500">Web 服务</strong>」。
            与地图用的「Web 端」Key <strong className="font-medium text-slate-500">不是同一个</strong>；填错时会看到 USERKEY_PLAT_NOMATCH。
            也可用环境变量 <code className="rounded bg-slate-100 px-1">VITE_AMAP_WEBSERVICE_KEY</code>。
          </p>
        </div>
      </div>

      <section className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="text-[13px] font-semibold text-slate-800">行程数据</h3>
        <p className="mt-1 text-[12px] text-slate-500">
          行程只存在这台设备的浏览器里。建议定期导出 JSON，换设备或清理数据前先备份。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => exportTripJson()}>导出行程 JSON</Btn>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-red-200/80 bg-red-50/60 p-3">
        <h3 className="text-[13px] font-semibold text-red-800">危险操作</h3>
        <p className="mt-1 text-[12px] text-red-700/90">
          清空后当前行程不可恢复。请先导出备份。
        </p>
        <div className="mt-2">
          <Btn
            className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
            onClick={() => {
              if (window.confirm('确定清空所有行程数据？此操作不可撤销。')) {
                clearTrip()
                setOpen(false)
              }
            }}
          >
            清空行程
          </Btn>
        </div>
      </section>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Btn variant="ghost" onClick={() => setOpen(false)}>
          取消
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          保存
        </Btn>
      </div>
    </Modal>
  )
}
