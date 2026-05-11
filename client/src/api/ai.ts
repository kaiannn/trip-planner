import type { TripContextPayload } from '../lib/aiPrompt'
import { getUserHeaders } from '../store/settingsStore'
import type { AiPoolCandidate, AiSection } from '../types'

let aiAbortController: AbortController | null = null

export function abortPendingAiRequest() {
  if (aiAbortController) {
    aiAbortController.abort()
    aiAbortController = null
  }
}

/**
 * Sleep for `ms` milliseconds, but abort early if `signal` is aborted.
 * Returns true if the sleep finished, false if it was aborted.
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false)
    const t = setTimeout(() => resolve(true), ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve(false)
      },
      { once: true },
    )
  })
}

/**
 * Whether the given thrown error looks like a transient failure that
 * justifies a retry. We treat:
 *   - 429 (rate limit), 5xx (server errors) as retryable
 *   - 401/403/400/404 etc. as terminal — retrying won't help
 *   - network errors (TypeError from fetch) as retryable
 *   - aborts as terminal (user moved on)
 */
function isTransientError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return false
  if (e instanceof TypeError) return true // network/CORS failures
  if (e instanceof Error) {
    const m = e.message.match(/HTTP (\d+)/)
    if (m) {
      const code = Number(m[1])
      return code === 429 || code >= 500
    }
    // server-emitted "流式推荐失败" / "请求失败" string errors —
    // treat as transient unless explicitly one of the terminal cases.
    return !/4\d\d/.test(e.message)
  }
  return false
}

export interface RetryOptions {
  /** Max attempts INCLUDING the first. So retries = maxAttempts - 1. */
  maxAttempts?: number
  /** Initial delay in ms; doubled each retry up to maxDelayMs. */
  baseDelayMs?: number
  /** Cap on per-retry delay. */
  maxDelayMs?: number
  /** Called before each retry with (attempt, delayMs, lastError). */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
  /** External abort signal (in addition to the module-level one). */
  signal?: AbortSignal
}

/**
 * Retry an async operation with exponential backoff + jitter.
 * Retries only on transient errors (network / 429 / 5xx / streaming).
 */
async function withRetry<T>(
  op: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
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
      // exponential backoff with ±20% jitter to avoid thundering herd.
      const exp = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1))
      const jitter = exp * (0.8 + Math.random() * 0.4)
      const delayMs = Math.round(jitter)
      opts.onRetry?.({ attempt, delayMs, error: e })
      const ok = await abortableSleep(delayMs, opts.signal)
      if (!ok) throw e
    }
  }
  // Unreachable, but TS wants it.
  throw lastErr
}

export async function fetchAiRecommend(
  prompt: string,
  retryOpts?: RetryOptions,
): Promise<AiSection[]> {
  return withRetry(async () => {
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
  }, retryOpts)
}

export interface StreamAiHandlers {
  /** Called every time the server emits more complete sections. */
  onSections?: (sections: AiSection[]) => void
  /** Called on progress events, before any sections are parseable. */
  onProgress?: (bytes: number) => void
  /** Called when a transient failure triggers a retry. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
}

/**
 * Streaming variant of fetchAiRecommend. Rejects on network/LLM errors,
 * resolves with the final section list on success. Partial section
 * updates arrive via `handlers.onSections` while the request is still
 * in flight, so the UI can render progressively.
 *
 * Auto-retries transient failures with exponential backoff. If a retry
 * happens after partial sections were already streamed, those sections
 * stay on screen — only NEW sections from the retry overwrite them.
 */
export async function streamAiRecommend(
  prompt: string,
  handlers: StreamAiHandlers = {},
  retryOpts?: RetryOptions,
): Promise<AiSection[]> {
  return withRetry(async () => {
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
              } else if (
                obj.type === 'progress' &&
                typeof obj.bytes === 'number'
              ) {
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
  }, {
    ...retryOpts,
    onRetry: (info) => {
      handlers.onRetry?.(info)
      retryOpts?.onRetry?.(info)
    },
  })
}

export interface PoiQueryResult {
  keywords: string
  types: string
  quality: 'normal' | 'high'
}

/**
 * AI seeds the Pool: pass a natural-language trip description and
 * optionally the user's selected cities; get back candidate spots.
 * The client geocodes these via AMap before adding to the pool.
 */
export async function fetchAiSeedPool(
  description: string,
  cities: { name: string }[],
  retryOpts?: RetryOptions,
): Promise<AiPoolCandidate[]> {
  return withRetry(async () => {
    const res = await fetch('/api/ai/seed-pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
      body: JSON.stringify({ description, cities }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `AI 填充景点池失败 ${res.status}`)
    return Array.isArray(data.candidates) ? data.candidates : []
  }, retryOpts)
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
