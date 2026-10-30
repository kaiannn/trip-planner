import type { TripContextPayload } from '../lib/aiPrompt'
import { useSettingsStore } from '../store/settingsStore'
import type { AiSection } from '../types'
import {
  buildCoarseFilterUserPrompt,
  COARSE_FILTER_SYSTEM_PROMPT,
  parseKeepIds,
  type CoarseFilterBriefLine,
  type CoarseFilterPoi,
} from '../lib/poiCoarseFilter'

let aiAbortController: AbortController | null = null

export function abortPendingAiRequest() {
  if (aiAbortController) {
    aiAbortController.abort()
    aiAbortController = null
  }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false)
    const t = setTimeout(() => resolve(true), ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(false) }, { once: true })
  })
}

function isTransientError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return false
  if (e instanceof TypeError) return true
  if (e instanceof Error) {
    const m = e.message.match(/HTTP (\d+)/)
    if (m) { const code = Number(m[1]); return code === 429 || code >= 500 }
    return !/4\d\d/.test(e.message)
  }
  return false
}

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
  signal?: AbortSignal
}

async function withRetry<T>(op: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3)
  const baseDelay = opts.baseDelayMs ?? 800
  const maxDelay = opts.maxDelayMs ?? 8000
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op(attempt)
    } catch (e) {
      lastErr = e
      if (attempt === maxAttempts || !isTransientError(e)) throw e
      const exp = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1))
      const jitter = exp * (0.8 + Math.random() * 0.4)
      const delayMs = Math.round(jitter)
      opts.onRetry?.({ attempt, delayMs, error: e })
      const ok = await abortableSleep(delayMs, opts.signal)
      if (!ok) throw e
    }
  }
  throw lastErr
}

// ── LLM direct call ──

function getLlmConfig() {
  const s = useSettingsStore.getState()
  return {
    key: s.llmApiKey,
    baseUrl: (s.llmBaseUrl || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
    model: s.llmModel || 'deepseek-chat',
  }
}

async function callLlm(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; stream?: boolean; signal?: AbortSignal } = {},
): Promise<Response> {
  const { key, baseUrl, model } = getLlmConfig()
  if (!key) throw new Error('未配置 LLM API Key，请在设置中填写。')
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, messages, temperature: opts.temperature ?? 0.4,
      response_format: { type: 'json_object' },
      ...(opts.stream ? { stream: true } : {}),
    }),
    signal: opts.signal,
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`LLM 请求失败：${resp.status} ${text.slice(0, 200)}`)
  }
  return resp
}

function parseSectionsFromJson(data: unknown): AiSection[] {
  const obj = data as Record<string, unknown>
  if (obj && typeof obj === 'object' && 'sections' in obj) return Array.isArray(obj.sections) ? obj.sections : []
  return []
}

// ── Public API ──

export interface StreamAiHandlers {
  onSections?: (sections: AiSection[]) => void
  onProgress?: (bytes: number) => void
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
}

export async function fetchAiRecommend(prompt: string, retryOpts?: RetryOptions): Promise<AiSection[]> {
  return withRetry(async () => {
    abortPendingAiRequest()
    aiAbortController = new AbortController()
    const resp = await callLlm([{ role: 'user', content: prompt }], { signal: aiAbortController.signal })
    aiAbortController = null
    return parseSectionsFromJson(await resp.json())
  }, retryOpts)
}

export async function streamAiRecommend(
  prompt: string, handlers: StreamAiHandlers = {}, retryOpts?: RetryOptions,
): Promise<AiSection[]> {
  return withRetry(async () => {
    abortPendingAiRequest()
    aiAbortController = new AbortController()
    const signal = aiAbortController.signal

    const resp = await callLlm([{ role: 'user', content: prompt }], { stream: true, signal })
    if (!resp.body) throw new Error('LLM 流式响应无 body')
    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let accumulated = ''
    let lastSectionsCount = 0
    let finalSections: AiSection[] = []

    const emitSectionsIfNew = () => {
      const idx = accumulated.indexOf('"sections"')
      if (idx < 0) return
      const openIdx = accumulated.indexOf('[', idx)
      if (openIdx < 0) return
      let depth = 0; let endIdx = -1
      for (let i = openIdx; i < accumulated.length; i++) {
        if (accumulated[i] === '[') depth++
        else if (accumulated[i] === ']') { depth--; if (depth === 0) { endIdx = i; break } }
      }
      let candidate: string
      if (endIdx >= 0) { candidate = accumulated.slice(openIdx, endIdx + 1) }
      else {
        const lastClose = accumulated.lastIndexOf('}')
        if (lastClose <= openIdx) return
        candidate = accumulated.slice(openIdx, lastClose + 1) + ']'
      }
      try {
        const arr = JSON.parse(candidate)
        if (Array.isArray(arr) && arr.length > lastSectionsCount) { lastSectionsCount = arr.length; handlers.onSections?.(arr) }
      } catch { /* partial */ }
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, nl); buffer = buffer.slice(nl + 2)
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') continue
            try {
              const obj = JSON.parse(payload)
              const delta = obj.choices?.[0]?.delta?.content || ''
              if (delta) { accumulated += delta; handlers.onProgress?.(accumulated.length); emitSectionsIfNew() }
            } catch { /* skip */ }
          }
        }
      }
    } finally { aiAbortController = null }

    try { finalSections = parseSectionsFromJson(JSON.parse(accumulated || '{}')) } catch { /* ignore */ }
    return finalSections
  }, {
    ...retryOpts,
    onRetry: (info) => { handlers.onRetry?.(info); retryOpts?.onRetry?.(info) },
  })
}

export interface PoiQueryResult {
  keywords: string
  types: string
  quality: 'normal' | 'high'
}

const POI_QUERY_PROMPT =
  '你是一个帮用户构建高德地图 POI 搜索参数的助手。' +
  '只输出 JSON 对象,不要任何解释文本。' +
  'JSON 结构为：{"keywords":字符串,"types":字符串可选,"quality":"normal"或"high"可选}。'

export async function fetchAiPoiQuery(
  naturalQuery: string, cityName: string, trip: TripContextPayload,
): Promise<PoiQueryResult> {
  const userParts = [`城市：${cityName}`, `用户的自然语言需求：${naturalQuery}`]
  if (trip) userParts.push('当前旅行上下文：' + JSON.stringify(trip).slice(0, 2000))
  const resp = await callLlm([
    { role: 'system', content: POI_QUERY_PROMPT },
    { role: 'user', content: userParts.join('\n\n') },
  ], { temperature: 0.3 })
  const parsed = (await resp.json()) as Record<string, unknown>
  return {
    keywords: ((parsed.keywords as string) || '').trim() || '景点',
    types: ((parsed.types as string) || '').trim(),
    quality: parsed.quality === 'high' ? 'high' : 'normal',
  }
}

/** Closed-set coarse filter: model only returns keepIds from provided POIs. */
export async function fetchAiPoiCoarseFilter(
  pois: CoarseFilterPoi[],
  brief: CoarseFilterBriefLine,
  opts: { maxKeep?: number; retryOpts?: RetryOptions } = {},
): Promise<string[]> {
  if (!pois.length) return []
  const maxKeep = Math.min(opts.maxKeep ?? 12, pois.length)
  const user = buildCoarseFilterUserPrompt(pois, brief, maxKeep)
  return withRetry(async () => {
    const resp = await callLlm([
      { role: 'system', content: COARSE_FILTER_SYSTEM_PROMPT },
      { role: 'user', content: user },
    ], { temperature: 0.2 })
    const parsed = (await resp.json()) as Record<string, unknown>
    const keep = parseKeepIds(parsed, pois.map((p) => p.id))
    return keep.slice(0, maxKeep)
  }, opts.retryOpts)
}
