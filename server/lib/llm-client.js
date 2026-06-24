import fetch from 'node-fetch';

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

export function getLlmBaseUrl() {
  return LLM_BASE_URL.replace(/\/$/, '');
}

export function getLlmModel() {
  return LLM_MODEL;
}

export function getLlmKey(req) {
  return process.env.LLM_API_KEY || (req.headers['x-llm-api-key'] || '').trim() || '';
}

export function requireLlmKey(req, res) {
  const key = getLlmKey(req);
  if (!key) {
    res.status(503).json({
      error: '未配置 LLM API Key。请在设置中填写，或在服务端 .env 中配置 LLM_API_KEY。',
    });
    return null;
  }
  return key;
}

/**
 * Call the LLM chat/completions endpoint.
 * Returns the parsed JSON response body.
 */
export async function callLlm({ key, messages, temperature = 0.4, stream = false, signal }) {
  const url = `${getLlmBaseUrl()}/chat/completions`;
  const body = {
    model: getLlmModel(),
    messages,
    temperature,
    response_format: { type: 'json_object' },
    ...(stream ? { stream: true } : {}),
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  if (!resp.ok) {
    const text = await resp.text();
    const error = new Error(`LLM 请求失败：${resp.status}`);
    error.llmStatus = resp.status;
    error.llmBody = text;
    throw error;
  }

  return resp;
}

/**
 * Extract and parse the JSON content from an LLM chat completion response.
 * Handles both content and tool_calls formats.
 */
export function parseLlmJsonResponse(data) {
  const content =
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
    '{}';

  if (typeof content !== 'string') return content;

  try {
    return JSON.parse(content);
  } catch (e) {
    const error = new Error('无法解析模型返回的 JSON，请检查模型是否严格按要求输出。');
    error.parseError = e;
    error.rawContent = content;
    throw error;
  }
}
