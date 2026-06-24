import { Router } from 'express';
import { callLlm, parseLlmJsonResponse, requireLlmKey } from '../lib/llm-client.js';

const router = Router();

router.post('/recommend', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: '请求体中缺少 prompt 字段。' });
    }
    const llmKey = requireLlmKey(req, res);
    if (!llmKey) return;

    const resp = await callLlm({
      key: llmKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const data = await resp.json();
    let parsed;
    try {
      parsed = parseLlmJsonResponse(data);
    } catch (e) {
      console.error('[PARSE ERROR]', e.parseError || e, e.rawContent || '');
      return res.status(500).json({ error: e.message });
    }

    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    return res.json({ sections });
  } catch (e) {
    if (e.llmStatus) {
      console.error('[LLM ERROR]', e.llmStatus, e.llmBody);
      return res.status(500).json({ error: e.message, detail: e.llmBody });
    }
    console.error('[API ERROR]', e);
    res.status(500).json({ error: '服务器内部错误', detail: e.message });
  }
});

/**
 * SSE streaming variant of /api/ai/recommend.
 *
 * Events emitted (each as: `data: {json}\n\n`):
 *   {type:"progress", bytes, text}   — fired every chunk with the
 *                                      full accumulated text so far
 *   {type:"sections", sections}      — fired whenever more complete
 *                                      section objects can be extracted
 *   {type:"done", sections}          — final payload on successful completion
 *   {type:"error", error}            — on any failure
 */
router.post('/recommend/stream', async (req, res) => {
  const { prompt } = req.body || {};
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };
  res.write(': ok\n\n');

  const abortCtl = new AbortController();
  req.on('close', () => abortCtl.abort());

  try {
    if (!prompt || typeof prompt !== 'string') {
      send({ type: 'error', error: '请求体中缺少 prompt 字段。' });
      return res.end();
    }
    const llmKey = requireLlmKey(req, res);
    if (!llmKey) {
      send({ type: 'error', error: '未配置 LLM API Key。' });
      return res.end();
    }

    const resp = await callLlm({
      key: llmKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      stream: true,
      signal: abortCtl.signal,
    });

    let accumulated = '';
    let lastSectionsCount = 0;
    let sseBuffer = '';

    const emitSectionsIfNew = () => {
      const idx = accumulated.indexOf('"sections"');
      if (idx < 0) return;
      const openIdx = accumulated.indexOf('[', idx);
      if (openIdx < 0) return;
      let depth = 0;
      let endIdx = -1;
      for (let i = openIdx; i < accumulated.length; i++) {
        const ch = accumulated[i];
        if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      let candidate;
      if (endIdx >= 0) {
        candidate = accumulated.slice(openIdx, endIdx + 1);
      } else {
        const lastClose = accumulated.lastIndexOf('}');
        if (lastClose <= openIdx) return;
        candidate = accumulated.slice(openIdx, lastClose + 1) + ']';
      }
      try {
        const arr = JSON.parse(candidate);
        if (Array.isArray(arr) && arr.length > lastSectionsCount) {
          lastSectionsCount = arr.length;
          send({ type: 'sections', sections: arr });
        }
      } catch {
        // partial — wait for more chunks
      }
    };

    for await (const chunk of resp.body) {
      sseBuffer += chunk.toString('utf8');
      let nl;
      while ((nl = sseBuffer.indexOf('\n\n')) >= 0) {
        const frame = sseBuffer.slice(0, nl);
        sseBuffer = sseBuffer.slice(nl + 2);
        const lines = frame.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const delta = obj.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              send({ type: 'progress', bytes: accumulated.length });
              emitSectionsIfNew();
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    }

    let finalSections = [];
    try {
      const parsed = JSON.parse(accumulated || '{}');
      if (Array.isArray(parsed.sections)) finalSections = parsed.sections;
    } catch (e) {
      console.error('[STREAM PARSE ERROR]', e, accumulated.slice(0, 500));
      send({ type: 'error', error: '模型输出未能解析为完整 JSON。' });
      return res.end();
    }

    send({ type: 'done', sections: finalSections });
    res.end();
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.end();
    }
    console.error('[STREAM API ERROR]', e);
    try {
      send({ type: 'error', error: e.message || '服务器内部错误' });
    } catch {
      /* socket already closed */
    }
    res.end();
  }
});

export default router;
