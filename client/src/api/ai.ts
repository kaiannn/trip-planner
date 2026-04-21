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
