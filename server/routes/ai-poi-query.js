import { Router } from 'express';
import { callLlm, parseLlmJsonResponse, requireLlmKey } from '../lib/llm-client.js';

const router = Router();

// AI 辅助生成高德 POI 搜索条件
router.post('/poi-query', async (req, res) => {
  try {
    const { naturalQuery, cityName, trip } = req.body || {};
    if (!naturalQuery || typeof naturalQuery !== 'string') {
      return res.status(400).json({ error: '缺少 naturalQuery 字段。' });
    }
    const llmKey = requireLlmKey(req, res);
    if (!llmKey) return;

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

    const resp = await callLlm({
      key: llmKey,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPromptParts.join('\n\n') },
      ],
      temperature: 0.3,
    });

    const data = await resp.json();
    let parsed;
    try {
      parsed = parseLlmJsonResponse(data);
    } catch (e) {
      console.error('[POI QUERY PARSE ERROR]', e.parseError || e, e.rawContent || '');
      return res.status(500).json({ error: e.message });
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
    if (e.llmStatus) {
      console.error('[LLM POI QUERY ERROR]', e.llmStatus, e.llmBody);
      return res.status(500).json({ error: e.message });
    }
    console.error('[API POI QUERY ERROR]', e);
    res.status(500).json({ error: '服务器内部错误', detail: e.message });
  }
});

export default router;
