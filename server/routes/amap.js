import { Router } from 'express';
import { requireAmapKey, fetchAmap } from '../lib/amap-client.js';

const router = Router();

router.get('/poi', async (req, res) => {
  try {
    const { city, keywords, types, page = 1, quality } = req.query || {};
    const amapKey = requireAmapKey(req, res);
    if (!amapKey) return;

    const data = await fetchAmap('text', {
      key: amapKey,
      keywords: (keywords && String(keywords).trim()) || '景点',
      city: (city && String(city).trim()) || undefined,
      citylimit: 'true',
      offset: '20',
      page: String(page || 1),
      types: types ? String(types) : undefined,
      extensions: 'all',
    });

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
    if (e.amapRaw) {
      console.error('[AMAP POI]', e.amapRaw, e.amapCode || '');
      return res.status(400).json({ error: e.message, pois: [], raw: e.amapRaw });
    }
    console.error('[AMAP POI ERROR]', e);
    res.status(500).json({ error: e.message, pois: [] });
  }
});

// 高德 POI 详情接口：通过 id 拉取更完整信息
router.get('/poi/detail', async (req, res) => {
  try {
    const { id } = req.query || {};
    const amapKey = requireAmapKey(req, res);
    if (!amapKey) return;
    if (!id) {
      return res.status(400).json({ error: '缺少 id 参数。' });
    }

    const data = await fetchAmap('detail', {
      key: amapKey,
      id: String(id),
      extensions: 'all',
    });

    const poi = Array.isArray(data.pois) ? data.pois[0] : null;
    res.json({ poi });
  } catch (e) {
    if (e.amapRaw) {
      console.error('[AMAP DETAIL]', e.amapRaw, e.amapCode || '');
      return res.status(400).json({ error: e.message });
    }
    console.error('[AMAP DETAIL ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
