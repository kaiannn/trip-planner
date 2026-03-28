import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('.')); // 前端静态文件,这样只开 npm start 即可,/api 同源

const PORT = process.env.PORT || 3001;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const LLM_API_KEY = process.env.LLM_API_KEY;
const AMAP_KEY = process.env.AMAP_KEY || '';

if (!LLM_API_KEY) {
  console.warn('[WARN] 未设置 LLM_API_KEY,/api/ai/recommend 调用会失败。请在 .env 中填写。');
}

app.post('/api/ai/recommend', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: '请求体中缺少 prompt 字段。' });
    }
    if (!LLM_API_KEY) {
      return res.status(500).json({
        error:
          '后端未配置 LLM_API_KEY,请在 .env 中填写你的 DeepSeek/豆包等模型的 API Key。',
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
        Authorization: `Bearer ${LLM_API_KEY}`,
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

app.get('/api/amap/poi', async (req, res) => {
  try {
    const { city, keywords, types, page = 1, quality } = req.query || {};
    if (!AMAP_KEY) {
      return res.status(503).json({
        error: '未配置 AMAP_KEY。请在 .env 中填写 AMAP_KEY,并在高德控制台为该 Key 开通「Web 服务」权限。',
        pois: [],
      });
    }
    const cityStr = (city && String(city).trim()) || '';
    const kw = (keywords && String(keywords).trim()) || '景点';
    const url = new URL('https://restapi.amap.com/v3/place/text');
    url.searchParams.set('key', AMAP_KEY);
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
    if (!AMAP_KEY) {
      return res.status(503).json({
        error: '未配置 AMAP_KEY。',
      });
    }
    if (!id) {
      return res.status(400).json({ error: '缺少 id 参数。' });
    }
    const url = new URL('https://restapi.amap.com/v3/place/detail');
    url.searchParams.set('key', AMAP_KEY);
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

// AI 辅助生成高德 POI 搜索条件
app.post('/api/ai/poi-query', async (req, res) => {
  try {
    const { naturalQuery, cityName, trip } = req.body || {};
    if (!naturalQuery || typeof naturalQuery !== 'string') {
      return res.status(400).json({ error: '缺少 naturalQuery 字段。' });
    }
    if (!LLM_API_KEY) {
      return res.status(503).json({
        error:
          '后端未配置 LLM_API_KEY,无法使用 AI 帮你解析高德搜索意图。',
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
        Authorization: `Bearer ${LLM_API_KEY}`,
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

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

