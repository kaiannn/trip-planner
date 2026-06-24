import fetch from 'node-fetch';

const AMAP_KEY = process.env.AMAP_KEY || '';

export function getAmapKey(req) {
  return AMAP_KEY || (req.headers['x-amap-key'] || '').trim() || '';
}

export function requireAmapKey(req, res) {
  const key = getAmapKey(req);
  if (!key) {
    res.status(503).json({
      error: '未配置高德 Key。请在设置中填写，或在服务端 .env 中配置 AMAP_KEY，并在高德控制台为该 Key 开通「Web 服务」权限。',
    });
    return null;
  }
  return key;
}

/**
 * Fetch from AMap REST API with standard error handling.
 * Returns the parsed JSON on success, throws with a descriptive error on failure.
 */
export async function fetchAmap(endpoint, params) {
  const url = new URL(`https://restapi.amap.com/v3/place/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const resp = await fetch(url.toString());
  const data = await resp.json();

  if (data.status !== '1') {
    const msg = data.info || '高德接口异常';
    const code = data.infocode || '';
    let hint = msg;
    if (/INVALID_USER_KEY|USERKEY_PLAT_NOMATCH|USERKEY_ILLEGAL/i.test(msg) || code === '10003') {
      hint = 'Key 无效或未开通「Web 服务」。请登录 高德开放平台 → 应用管理 → 该 Key → 勾选「Web 服务」并保存（与地图可共用同一 Key）。';
    }
    const error = new Error(hint);
    error.amapRaw = msg;
    error.amapCode = code;
    throw error;
  }

  return data;
}
