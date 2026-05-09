import type { TripContextPayload } from '../lib/aiPrompt'
import { getUserHeaders } from '../store/settingsStore'
import type { AiSection } from '../types'

let aiAbortController: AbortController | null = null

export function abortPendingAiRequest() {
  if (aiAbortController) {
    aiAbortController.abort()
    aiAbortController = null
  }
}

export async function fetchAiRecommend(prompt: string): Promise<AiSection[]> {
  abortPendingAiRequest()
  aiAbortController = new AbortController()
  const res = await fetch('/api/ai/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
    body: JSON.stringify({ prompt }),
    signal: aiAbortController.signal,
  })
  aiAbortController = null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.sections) ? data.sections : []
}

export interface StreamAiHandlers {
  /** Called every time the server emits more complete sections. */
  onSections?: (sections: AiSection[]) => void
  /** Called on progress events, before any sections are parseable. */
  onProgress?: (bytes: number) => void
}

/**
 * Streaming variant of fetchAiRecommend. Rejects on network/LLM errors,
 * resolves with the final section list on success. Partial section
 * updates arrive via `handlers.onSections` while the request is still
 * in flight, so the UI can render progressively.
 */
export async function streamAiRecommend(
  prompt: string,
  handlers: StreamAiHandlers = {},
): Promise<AiSection[]> {
  abortPendingAiRequest()
  aiAbortController = new AbortController()
  const signal = aiAbortController.signal

  const res = await fetch('/api/ai/recommend/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
    body: JSON.stringify({ prompt }),
    signal,
  })

  if (!res.ok || !res.body) {
    aiAbortController = null
    throw new Error(`HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalSections: AiSection[] = []
  let serverError: string | null = null

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames end with a blank line (two newlines).
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            const obj = JSON.parse(payload) as {
              type: string
              sections?: AiSection[]
              bytes?: number
              error?: string
            }
            if (obj.type === 'sections' && Array.isArray(obj.sections)) {
              handlers.onSections?.(obj.sections)
            } else if (obj.type === 'progress' && typeof obj.bytes === 'number') {
              handlers.onProgress?.(obj.bytes)
            } else if (obj.type === 'done' && Array.isArray(obj.sections)) {
              finalSections = obj.sections
            } else if (obj.type === 'error') {
              serverError = obj.error || '流式推荐失败'
            }
          } catch {
            // skip malformed frame
          }
        }
      }
    }
  } finally {
    aiAbortController = null
  }

  if (serverError) throw new Error(serverError)
  return finalSections
}

export interface PoiQueryResult {
  keywords: string
  types: string
  quality: 'normal' | 'high'
}

export async function fetchAiPoiQuery(
  naturalQuery: string,
  cityName: string,
  trip: TripContextPayload,
): Promise<PoiQueryResult> {
  const res = await fetch('/api/ai/poi-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
    body: JSON.stringify({ naturalQuery, cityName, trip }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `AI 解析失败 ${res.status}`)
  return {
    keywords: (data.keywords || '').trim() || '景点',
    types: (data.types || '').trim(),
    quality: data.quality === 'high' ? 'high' : 'normal',
  }
}
