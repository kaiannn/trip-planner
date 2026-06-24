import { Router } from 'express';

const router = Router();

const LLM_API_KEY = process.env.LLM_API_KEY;
const AMAP_KEY = process.env.AMAP_KEY || '';

if (!LLM_API_KEY) {
  console.warn('[WARN] 未设置 LLM_API_KEY，/api/ai/recommend 调用会失败。请在 .env 中填写。');
}

router.get('/status', (_req, res) => {
  res.json({
    llm: !!LLM_API_KEY,
    amap: !!AMAP_KEY,
  });
});

export default router;
