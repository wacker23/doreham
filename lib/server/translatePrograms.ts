import 'server-only';
import { createHash } from 'node:crypto';
import { getVercelOidcToken } from '@vercel/oidc';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { volunteerCategoryEn } from '@/lib/volunteerCategories';

/**
 * English versions of 1365 volunteer programs.
 *
 * 1365 publishes Korean only. When a program is shown to a group (vote options, the chosen activity),
 * its title, place, organisation and description are translated once through Vercel AI Gateway and
 * cached on volunteer_programs (*_en columns). The Korean original is always kept and shown in Korean
 * mode. If the Korean text changes on 1365 (detail refresh), translation_source_hash no longer matches
 * and the program is translated again the next time it is needed.
 *
 * Auth: AI_GATEWAY_API_KEY when set (local dev), otherwise the deployment's Vercel OIDC token.
 * Everything here is best-effort: when translation is unavailable the app shows the Korean text.
 */

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
// Tried in order; the first one this Vercel team can use is remembered for the rest of the instance's life.
// (The AI Gateway free tier does not include every model, e.g. claude-haiku-4.5 needs paid credits.)
const MODELS = (process.env.TRANSLATION_MODELS ||
  'google/gemini-3.5-flash-lite,anthropic/claude-haiku-4.5,google/gemini-2.5-flash-lite,openai/gpt-5-mini,alibaba/qwen3.8-flash,deepseek/deepseek-v4-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
let preferredModel = 0;
const MAX_DESCRIPTION_CHARS = 3000;
const CONCURRENCY = 4;

const SYSTEM_PROMPT = `You translate Korean volunteer listings from Korea's 1365 volunteer portal into clear, natural English for foreign residents living in Korea.

Rules:
- Translate faithfully. Do not add, guess or leave out information.
- Keep numbers, dates, times, ages, phone numbers, emails and street numbers exactly as written. Dates may be written in English style (e.g. "Sep 29 (Tue)").
- Organisation and place names: translate the generic parts (복지관 = Welfare Center, 돌봄센터 = Care Center, 과학관 = Science Museum, 주민센터 = Community Center, 도서관 = Library) and romanize proper names (아산 = Asan, 천안 = Cheonan, 선문대학교 = Sun Moon University).
- Keep who may join (age, school level, gender) and any instructions such as "confirm approval with the staff before visiting".
- Drop decorative symbols and broken characters (for example "？？"). Keep the description's line structure; use "- " for list items.
- If a field is empty, return an empty string for it.

Reply with JSON only, no other text: {"title": "...", "place": "...", "org_name": "...", "description": "..."}`;

type ProgramRow = {
  id: string;
  title: string;
  place: string | null;
  org_name: string | null;
  description: string | null;
  category: string | null;
  title_en: string | null;
  translation_source_hash: string | null;
};

type Translation = { title: string; place: string; org_name: string; description: string };

function sourceHash(p: Pick<ProgramRow, 'title' | 'place' | 'org_name' | 'description'>): string {
  return createHash('sha1')
    .update(JSON.stringify([p.title, p.place ?? '', p.org_name ?? '', p.description ?? '']))
    .digest('hex')
    .slice(0, 16);
}

async function gatewayToken(): Promise<string | null> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    return (await getVercelOidcToken()) || null;
  } catch {
    return process.env.VERCEL_OIDC_TOKEN || null;
  }
}

function parseTranslation(text: string): Translation | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const t = { title: str(obj.title), place: str(obj.place), org_name: str(obj.org_name), description: str(obj.description) };
    return t.title ? t : null;
  } catch {
    return null;
  }
}

async function callModel(model: string, p: ProgramRow, token: string, signal: AbortSignal): Promise<Translation> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      // Reasoning-style OpenAI models only accept the default temperature.
      ...(model.startsWith('openai/gpt-5') ? {} : { temperature: 0 }),
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            title: p.title,
            place: p.place ?? '',
            org_name: p.org_name ?? '',
            description: (p.description ?? '').slice(0, MAX_DESCRIPTION_CHARS),
          }),
        },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${model} ${res.status}: ${body.slice(0, 160)}`);
  const content = (JSON.parse(body) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '';
  const t = parseTranslation(content);
  if (!t) throw new Error(`${model} unparseable reply: ${content.slice(0, 100)}`);
  return t;
}

/** Try the models in order, starting from the last one that worked. */
async function translateOne(p: ProgramRow, token: string, signal: AbortSignal): Promise<{ t: Translation; model: string }> {
  const errors: string[] = [];
  for (let k = 0; k < MODELS.length; k++) {
    const i = (preferredModel + k) % MODELS.length;
    if (signal.aborted) break;
    try {
      const t = await callModel(MODELS[i], p, token, signal);
      preferredModel = i;
      return { t, model: MODELS[i] };
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(' | ').slice(0, 600));
}

export type TranslationReport = {
  requested: number;
  translated: number;
  already: number;
  models?: Record<string, number>;
  skipped?: string;
  errors: string[];
};

/**
 * Make sure these programs have an up-to-date English version. Safe to call often:
 * programs already translated from the same Korean text are skipped.
 */
export async function ensureProgramTranslations(
  programIds: string[],
  opts: { timeoutMs?: number; limit?: number } = {},
): Promise<TranslationReport> {
  const ids = [...new Set(programIds.filter(Boolean))];
  const report: TranslationReport = { requested: ids.length, translated: 0, already: 0, errors: [] };
  if (ids.length === 0) return report;

  const admin = getAdmin();
  const { data } = await admin
    .from('volunteer_programs')
    .select('id, title, place, org_name, description, category, title_en, translation_source_hash')
    .in('id', ids);
  const rows = (data ?? []) as ProgramRow[];
  const todo = rows.filter((r) => !r.title_en || r.translation_source_hash !== sourceHash(r)).slice(0, opts.limit ?? 50);
  report.already = rows.length - todo.length;
  if (todo.length === 0) return report;

  const token = await gatewayToken();
  if (!token) {
    report.skipped = 'no AI Gateway credentials (set AI_GATEWAY_API_KEY for local dev)';
    return report;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
      const batch = todo.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (p) => {
          try {
            const { t, model } = await translateOne(p, token, controller.signal);
            report.models = { ...(report.models ?? {}), [model]: (report.models?.[model] ?? 0) + 1 };
            const { error } = await admin
              .from('volunteer_programs')
              .update({
                title_en: t.title,
                place_en: t.place || null,
                org_name_en: t.org_name || null,
                description_en: t.description || null,
                category_en: volunteerCategoryEn(p.category),
                translated_at: new Date().toISOString(),
                translation_source_hash: sourceHash(p),
              })
              .eq('id', p.id);
            if (error) throw new Error(error.message);
            report.translated++;
          } catch (e: unknown) {
            report.errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }),
      );
      if (controller.signal.aborted) break;
    }
  } finally {
    clearTimeout(timer);
  }
  return report;
}

/**
 * Cron sweep: translate every program a live group can see (vote options and chosen activities)
 * that has no English version yet or whose Korean text changed.
 */
export async function translateActivePrograms(limit = 20): Promise<TranslationReport> {
  const admin = getAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: groups } = await admin
    .from('groups')
    .select('id')
    .eq('quest_type', 'volunteer')
    .in('phase', ['voting', 'scheduled', 'completed'])
    .gte('created_at', since);
  const groupIds = (groups ?? []).map((g) => g.id as string);
  if (groupIds.length === 0) return { requested: 0, translated: 0, already: 0, errors: [] };

  const [{ data: slots }, { data: quests }] = await Promise.all([
    admin.from('candidate_slots').select('volunteer_program_id').in('group_id', groupIds).not('volunteer_program_id', 'is', null),
    admin.from('quests').select('volunteer_program_id').in('group_id', groupIds).not('volunteer_program_id', 'is', null),
  ]);
  const ids = [...(slots ?? []), ...(quests ?? [])].map((r) => r.volunteer_program_id as string);
  return ensureProgramTranslations(ids, { limit, timeoutMs: 120_000 });
}
