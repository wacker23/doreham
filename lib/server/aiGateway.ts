import 'server-only';
import { getVercelOidcToken } from '@vercel/oidc';

/**
 * Small client for Vercel AI Gateway (OpenAI-compatible chat completions), used for translation.
 *
 * Auth: AI_GATEWAY_API_KEY when set (local dev), otherwise the deployment's Vercel OIDC token.
 * Models are tried in order (TRANSLATION_MODELS); the first one this Vercel team can use is
 * remembered for the rest of the instance's life. The free tier does not include every model.
 */

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODELS = (process.env.TRANSLATION_MODELS ||
  'google/gemini-2.5-flash-lite,google/gemini-3.5-flash-lite,anthropic/claude-haiku-4.5,openai/gpt-5-mini,alibaba/qwen3.8-flash,deepseek/deepseek-v4-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
let preferredModel = 0;

export async function gatewayToken(): Promise<string | null> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    return (await getVercelOidcToken()) || null;
  } catch {
    return process.env.VERCEL_OIDC_TOKEN || null;
  }
}

/** Pull the first {...} object out of a model reply. */
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callModel(model: string, system: string, user: string, token: string, signal: AbortSignal, maxTokens: number) {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      // Reasoning-style OpenAI models only accept the default temperature.
      ...(model.startsWith('openai/gpt-5') ? {} : { temperature: 0 }),
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${model} ${res.status}: ${body.slice(0, 160)}`);
  const content = (JSON.parse(body) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '';
  const json = extractJson(content);
  if (!json) throw new Error(`${model} unparseable reply: ${content.slice(0, 100)}`);
  return json;
}

/**
 * Ask for a JSON reply. Tries the models in order, starting from the last one that worked.
 * Throws with every model's error when none succeeds.
 */
export async function chatJson(opts: {
  system: string;
  user: string;
  token: string;
  signal: AbortSignal;
  maxTokens?: number;
}): Promise<{ json: Record<string, unknown>; model: string }> {
  const errors: string[] = [];
  for (let k = 0; k < MODELS.length; k++) {
    const i = (preferredModel + k) % MODELS.length;
    if (opts.signal.aborted) break;
    try {
      const json = await callModel(MODELS[i], opts.system, opts.user, opts.token, opts.signal, opts.maxTokens ?? 2000);
      preferredModel = i;
      return { json, model: MODELS[i] };
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(' | ').slice(0, 600));
}

/** 'ko' when the text is mostly Hangul, 'en' when mostly Latin letters, otherwise 'other'. */
export function detectLang(text: string): 'ko' | 'en' | 'other' {
  let hangul = 0;
  let latin = 0;
  let other = 0;
  for (const ch of text) {
    if (/[가-힣ㄱ-ㆎ]/.test(ch)) hangul++;
    else if (/[A-Za-z]/.test(ch)) latin++;
    else if (/\p{L}/u.test(ch)) other++;
  }
  const letters = hangul + latin + other;
  if (letters === 0) return 'en';
  if (hangul / letters >= 0.3) return 'ko';
  if (latin / letters >= 0.6) return 'en';
  return 'other';
}
