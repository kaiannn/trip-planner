import { Router } from 'express';
import { callLlm, parseLlmJsonResponse, requireLlmKey } from '../lib/llm-client.js';

const router = Router();

/**
 * AI seeds the Pool: takes a natural-language description of the
 * trip and returns candidate spots (name / cityHint / description).
 * Coords are optional — the client will geocode each candidate via
 * AMap before adding to the pool.
 *
 * Response shape:
 *   { candidates: AiPoolCandidate[] }
 */
router.post('/seed-pool', async (req, res) => {
  try {
    const { description, cities } = req.body || {};
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: '缺少 description 字段。' });
    }
    const llmKey = requireLlmKey(req, res);
    if (!llmKey) return;

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

    const resp = await callLlm({
      key: llmKey,
      messages: [
        { role: 'system', content: sysPrompt },
        {
          role: 'user',
          content: `${citiesHint}\n\n用户的描述：\n${description}`,
        },
      ],
      temperature: 0.5,
    });

    const data = await resp.json();
    let parsed;
    try {
      parsed = parseLlmJsonResponse(data);
    } catch (e) {
      console.error('[SEED POOL PARSE ERROR]', e.parseError || e, e.rawContent || '');
      return res.status(500).json({ error: e.message });
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
    if (e.llmStatus) {
      console.error('[SEED POOL ERROR]', e.llmStatus, e.llmBody);
      return res.status(500).json({ error: e.message });
    }
    console.error('[SEED POOL API ERROR]', e);
    res.status(500).json({ error: '服务器内部错误', detail: e.message });
  }
});

export default router;
