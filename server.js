import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length
        ? ALLOWED_ORIGINS
        : true,
  }),
);
app.use(express.json({ limit: '1mb' }));

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function rateLimit(req, res, next) {
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry = { start: now, count: 0 };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试。' });
  }
  next();
}

app.use('/api', rateLimit);

const PORT = process.env.PORT || 3001;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const LLM_API_KEY = process.env.LLM_API_KEY;
const AMAP_KEY = process.env.AMAP_KEY || '';

function getLlmKey(req) {
  return LLM_API_KEY || (req.headers['x-llm-api-key'] || '').trim() || '';
}

function getAmapKey(req) {
  return AMAP_KEY || (req.headers['x-amap-key'] || '').trim() || '';
}

if (!LLM_API_KEY) {
  console.warn('[WARN] 未设置 LLM_API_KEY,/api/ai/recommend 调用会失败。请在 .env 中填写。');
}

app.get('/api/config/status', (_req, res) => {
  res.json({
    llm: !!LLM_API_KEY,
    amap: !!AMAP_KEY,
  });
});

app.post('/api/ai/recommend', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: '请求体中缺少 prompt 字段。' });
    }
    const llmKey = getLlmKey(req);
    if (!llmKey) {
      return res.status(500).json({
        error:
          '未配置 LLM API Key。请在设置中填写，或在服务端 .env 中配置 LLM_API_KEY。',
      });
    }

    const url = `${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;

    const body = {
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[LLM ERROR]', resp.status, text);
      return res.status(500).json({
        error: `LLM 请求失败：${resp.status}`,
        detail: text,
      });
    }

    const data = await resp.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
      '{}';

    let parsed;
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      console.error('[PARSE ERROR]', e, content);
      return res.status(500).json({
        error: '无法解析模型返回的 JSON,请检查模型是否严格按要求输出。',
      });
    }

    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    return res.json({ sections });
  } catch (e) {
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
app.post('/api/ai/recommend/stream', async (req, res) => {
  const { prompt } = req.body || {};
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders?.();

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };
  // One pre-flight comment so proxies commit to streaming immediately.
  res.write(': ok\n\n');

  const abortCtl = new AbortController();
  req.on('close', () => abortCtl.abort());

  try {
    if (!prompt || typeof prompt !== 'string') {
      send({ type: 'error', error: '请求体中缺少 prompt 字段。' });
      return res.end();
    }
    const llmKey = getLlmKey(req);
    if (!llmKey) {
      send({
        type: 'error',
        error:
          '未配置 LLM API Key。请在设置中填写，或在服务端 .env 中配置 LLM_API_KEY。',
      });
      return res.end();
    }

    const url = `${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
      stream: true,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: abortCtl.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[LLM STREAM ERROR]', resp.status, text);
      send({
        type: 'error',
        error: `LLM 请求失败：${resp.status}`,
      });
      return res.end();
    }

    let accumulated = '';
    let lastSectionsCount = 0;
    let sseBuffer = '';

    const emitSectionsIfNew = () => {
      // Heuristic: grab everything between `"sections":[` and the matching
      // `]` if the JSON is already balanced so far. We only parse when a
      // new complete object `},` appeared since the last emit, to keep CPU
      // negligible. Invalid-JSON extractions are silently dropped.
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
      // When the array isn't closed yet, try to parse what we have by
      // appending a synthetic ']' after the last complete `}`.
      let candidate;
      if (endIdx >= 0) {
        candidate = accumulated.slice(openIdx, endIdx + 1);
      } else {
        // find last `}` — everything before it may form a valid array.
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
      // SSE frames are terminated by double newlines.
      let nl;
      while ((nl = sseBuffer.indexOf('\n\n')) >= 0) {
        const frame = sseBuffer.slice(0, nl);
        sseBuffer = sseBuffer.slice(nl + 2);
        // One frame can contain multiple `data:` lines; concatenate them.
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

    // Final parse of the fully accumulated JSON.
    let finalSections = [];
    try {
      const parsed = JSON.parse(accumulated || '{}');
      if (Array.isArray(parsed.sections)) finalSections = parsed.sections;
    } catch (e) {
      console.error('[STREAM PARSE ERROR]', e, accumulated.slice(0, 500));
      send({
        type: 'error',
        error: '模型输出未能解析为完整 JSON。',
      });
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

app.get('/api/amap/poi', async (req, res) => {
  try {
    const { city, keywords, types, page = 1, quality } = req.query || {};
    const amapKey = getAmapKey(req);
    if (!amapKey) {
      return res.status(503).json({
        error: '未配置高德 Key。请在设置中填写，或在服务端 .env 中配置 AMAP_KEY，并在高德控制台为该 Key 开通「Web 服务」权限。',
        pois: [],
      });
    }
    const cityStr = (city && String(city).trim()) || '';
    const kw = (keywords && String(keywords).trim()) || '景点';
    const url = new URL('https://restapi.amap.com/v3/place/text');
    url.searchParams.set('key', amapKey);
    url.searchParams.set('keywords', kw);
    if (cityStr) url.searchParams.set('city', cityStr);
    url.searchParams.set('citylimit', 'true');
    url.searchParams.set('offset', '20');
    url.searchParams.set('page', String(page || 1));
    if (types) url.searchParams.set('types', String(types));
    // 使用 extensions=all 以便拿到评分、价格等扩展信息
    url.searchParams.set('extensions', 'all');

    const resp = await fetch(url.toString());
    const data = await resp.json();
    if (data.status !== '1') {
      const msg = data.info || '高德接口异常';
      const code = data.infocode || '';
      console.error('[AMAP POI]', data.status, msg, code);
      let hint = msg;
      if (/INVALID_USER_KEY|USERKEY_PLAT_NOMATCH|USERKEY_ILLEGAL/i.test(msg) || code === '10003') {
        hint = 'Key 无效或未开通「Web 服务」。请登录 高德开放平台 → 应用管理 → 该 Key → 勾选「Web 服务」并保存（与地图可共用同一 Key）。';
      }
      return res.status(400).json({ error: hint, pois: [], raw: msg });
    }

    let pois = Array.isArray(data.pois) ? data.pois : [];

    // 简单的「高质量」筛选：按评分排序并截取前若干
    if (quality === 'high' && pois.length) {
      pois = pois
        .slice()
        .sort((a, b) => {
          const ra = Number(a.biz_ext?.rating || a.rating || 0);
          const rb = Number(b.biz_ext?.rating || b.rating || 0);
          return rb - ra;
        })
        .slice(0, 20);
    }

    res.json({ pois });
  } catch (e) {
    console.error('[AMAP POI ERROR]', e);
    res.status(500).json({ error: e.message, pois: [] });
  }
});

// 高德 POI 详情接口：通过 id 拉取更完整信息
app.get('/api/amap/poi/detail', async (req, res) => {
  try {
    const { id } = req.query || {};
    const amapKey = getAmapKey(req);
    if (!amapKey) {
      return res.status(503).json({
        error: '未配置高德 Key。',
      });
    }
    if (!id) {
      return res.status(400).json({ error: '缺少 id 参数。' });
    }
    const url = new URL('https://restapi.amap.com/v3/place/detail');
    url.searchParams.set('key', amapKey);
    url.searchParams.set('id', String(id));
    url.searchParams.set('extensions', 'all');

    const resp = await fetch(url.toString());
    const data = await resp.json();
    if (data.status !== '1') {
      const msg = data.info || '高德详情接口异常';
      console.error('[AMAP DETAIL]', data.status, msg, data.infocode || '');
      return res.status(400).json({ error: msg });
    }
    const poi = Array.isArray(data.pois) ? data.pois[0] : null;
    res.json({ poi });
  } catch (e) {
    console.error('[AMAP DETAIL ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * AI seeds the Pool: takes a natural-language description of the
 * trip and returns candidate spots (name / cityHint / description).
 * Coords are optional — the client will geocode each candidate via
 * AMap before adding to the pool.
 *
 * Response shape:
 *   { candidates: AiPoolCandidate[] }
 */
app.post('/api/ai/seed-pool', async (req, res) => {
  try {
    const { description, cities } = req.body || {};
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: '缺少 description 字段。' });
    }
    const llmKey = getLlmKey(req);
    if (!llmKey) {
      return res.status(503).json({
        error: '未配置 LLM API Key。',
      });
    }

    const citiesHint = Array.isArray(cities) && cities.length
      ? `已选城市：${cities.map((c) => c?.name).filter(Boolean).join('、')}`
      : '（用户暂未选择城市，请从描述里推断）';

    const sysPrompt =
      '你在帮用户搜集「可能感兴趣的候选地点」,用于扔进他们的景点池。' +
      '候选包括三种 kind:景点(sight)、酒店(hotel)、餐厅(restaurant)。' +
      '判断方式:' +
      '当用户提到「住」「酒店」「民宿」「客栈」「住哪」时,放 hotel。' +
      '当用户提到「吃」「餐厅」「小馆子」「美食」「饭店」「火锅」「夜宵」时,放 restaurant。' +
      '其他默认 sight。' +
      '只输出一个 JSON 对象,不要任何解释文字。' +
      'JSON 结构为 {"candidates":[{"name":"名称","kind":"sight"或"hotel"或"restaurant","cityHint":"城市","address":"地址可选","description":"1-2 句话介绍","price":"酒店价格,例¥350/晚","link":"餐厅推荐链接,可选"}]}。' +
      '至少给 10 个,至多给 20 个。' +
      '要尽可能贴合用户描述(偏好、人数、节奏),不要只抄 Top-10 热门景点。' +
      '没有提到住和吃就不要包含 hotel / restaurant,以景点为主。' +
      '提到了就至少给 1-2 个对应类型的候选。';

    const url = `${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: sysPrompt },
        {
          role: 'user',
          content: `${citiesHint}\n\n用户的描述：\n${description}`,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[SEED POOL ERROR]', resp.status, text);
      return res.status(500).json({
        error: `LLM 请求失败：${resp.status}`,
      });
    }

    const data = await resp.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
      '{}';

    let parsed;
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      console.error('[SEED POOL PARSE ERROR]', e, content);
      return res.status(500).json({
        error: '无法解析模型返回的 JSON。',
      });
    }

    const raw = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const candidates = raw
      .filter((c) => c && typeof c.name === 'string' && c.name.trim())
      .map((c) => {
        const kindRaw = typeof c.kind === 'string' ? c.kind.toLowerCase() : '';
        const kind =
          kindRaw === 'hotel' || kindRaw === 'restaurant' ? kindRaw : 'sight';
        return {
          name: String(c.name).trim(),
          kind,
          cityHint: c.cityHint ? String(c.cityHint).trim() : undefined,
          address: c.address ? String(c.address).trim() : undefined,
          description: c.description ? String(c.description).trim() : undefined,
          lat: typeof c.lat === 'number' ? c.lat : undefined,
          lng: typeof c.lng === 'number' ? c.lng : undefined,
          price: kind === 'hotel' && c.price ? String(c.price).trim() : undefined,
          link: kind === 'restaurant' && c.link ? String(c.link).trim() : undefined,
        };
      })
      .slice(0, 20);

    res.json({ candidates });
  } catch (e) {
    console.error('[SEED POOL API ERROR]', e);
    res.status(500).json({ error: '服务器内部错误', detail: e.message });
  }
});

// AI 辅助生成高德 POI 搜索条件
app.post('/api/ai/poi-query', async (req, res) => {
  try {
    const { naturalQuery, cityName, trip } = req.body || {};
    if (!naturalQuery || typeof naturalQuery !== 'string') {
      return res.status(400).json({ error: '缺少 naturalQuery 字段。' });
    }
    const llmKey = getLlmKey(req);
    if (!llmKey) {
      return res.status(503).json({
        error:
          '未配置 LLM API Key。请在设置中填写，或在服务端 .env 中配置 LLM_API_KEY。',
      });
    }

    const url = `${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;

    const sysPrompt =
      '你是一个帮用户构建高德地图 POI 搜索参数的助手。' +
      '只输出 JSON 对象,不要任何解释文本。' +
      'JSON 结构为：{"keywords":字符串,"types":字符串可选,"quality":"normal"或"high"可选}。' +
      'keywords 尽量简短,适合作为高德 place/text 接口的 keywords。' +
      'types 使用高德 POI 类型编码字符串,例如 "110000" 表示风景名胜,"050000" 表示餐饮服务,"060000" 表示购物服务。' +
      '当用户想找景点 / 风景 / 博物馆 / 公园时,优先使用 "110000"。' +
      '当用户强调高质量、评价好、口碑好时,将 quality 设为 "high"。';

    const userPromptParts = [];
    if (cityName) {
      userPromptParts.push(`城市：${cityName}`);
    }
    userPromptParts.push(`用户的自然语言需求：${naturalQuery}`);
    if (trip && typeof trip === 'object') {
      userPromptParts.push(
        '当前旅行上下文仅供你理解场景,不需要完全复述：' +
          JSON.stringify(trip).slice(0, 2000),
      );
    }

    const body = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPromptParts.join('\n\n') },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[LLM POI QUERY ERROR]', resp.status, text);
      return res.status(500).json({
        error: `LLM 请求失败：${resp.status}`,
      });
    }

    const data = await resp.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
      '{}';

    let parsed;
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      console.error('[POI QUERY PARSE ERROR]', e, content);
      return res.status(500).json({
        error: '无法解析模型返回的 JSON。',
      });
    }

    const result = {
      keywords: parsed.keywords || '',
      types: parsed.types || '',
      quality: parsed.quality || 'normal',
    };
    if (!result.keywords) {
      result.keywords = '景点';
    }

    res.json(result);
  } catch (e) {
    console.error('[API POI QUERY ERROR]', e);
    res.status(500).json({ error: '服务器内部错误', detail: e.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

