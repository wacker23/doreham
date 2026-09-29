import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { kstDateString } from '@/lib/server/time';

/**
 * Client for 행정안전부_봉사참여정보서비스 (1365 자원봉사포털) on data.go.kr.
 *
 * Operations used:
 *   getVltrSearchWordList — list programs (keyword / region / dates / adult-OK)
 *   getVltrPartcptnItem   — one program's full details (recruit/applied counts, times, place…)
 *
 * Env:
 *   DATA_GO_KR_API_KEY        — the account's 일반 인증키 (same key for every data.go.kr API)
 *   VOLUNTEER_1365_API_BASE   — the End Point shown on the data.go.kr page (…/VolunteerPartcptnService)
 *
 * Field names follow the 1365 spec; normalizeProgram() accepts a few aliases so a
 * gateway rename doesn't silently drop data. Verify against a real response with
 * /api/admin/volunteer-probe before trusting a new endpoint.
 */

export type RawItem = Record<string, string>;

export type VolunteerProgram = {
  id: string;
  title: string;
  status: number | null;
  program_start: string | null;
  program_end: string | null;
  act_begin_hour: number | null;
  act_end_hour: number | null;
  notice_start: string | null;
  notice_end: string | null;
  recruit_count: number | null;
  applied_count: number | null;
  act_weekdays: string | null;
  category: string | null;
  adult_ok: boolean | null;
  youth_ok: boolean | null;
  group_ok: boolean | null;
  org_name: string | null;
  registrar_name: string | null;
  place: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  description: string | null;
  sido_code: string | null;
  gugun_code: string | null;
  detail_url: string;
};

/** Cities Doreham supports for volunteer quests, with how to find their programs. */
export const VOLUNTEER_CITIES: { slug: string; keyword: string; sidoName: string; gugunName: string }[] = [
  { slug: 'asan', keyword: '아산', sidoName: '충청남도', gugunName: '아산시' },
  { slug: 'cheonan', keyword: '천안', sidoName: '충청남도', gugunName: '천안시' },
];

export const ALLOWED_OPERATIONS = [
  'getVltrSearchWordList',
  'getVltrPartcptnItem',
  'getVltrPeriodSrvcList',
  'getVltrAreaList',
  'getVltrCategoryList',
] as const;
export type Operation = (typeof ALLOWED_OPERATIONS)[number];

export function signupUrl(programId: string): string {
  return `https://www.1365.go.kr/vols/P9210/partcptn/timeCptn.do?type=show&progrmRegistNo=${encodeURIComponent(programId)}`;
}

// ---------------------------------------------------------------------------
// HTTP + XML
// ---------------------------------------------------------------------------

function apiBase(): string {
  const base = process.env.VOLUNTEER_1365_API_BASE;
  if (!base) throw new Error('VOLUNTEER_1365_API_BASE is not set');
  return base.replace(/\/+$/, '');
}

function serviceKeyParam(): string {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) throw new Error('DATA_GO_KR_API_KEY is not set');
  // data.go.kr issues an "Encoding" and a "Decoding" form of the same key.
  return key.includes('%') ? key : encodeURIComponent(key);
}

function decodeXml(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();
}

/** Flat <item><a>1</a><b>2</b></item> parser — the 1365 responses have no nesting inside items. */
export function parseItems(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const fields: RawItem = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(m[1]))) fields[f[1]] = decodeXml(f[2]);
    items.push(fields);
  }
  return items;
}

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeXml(m[1]) : null;
}

export type ApiResult = { ok: boolean; resultCode: string | null; resultMsg: string | null; totalCount: number | null; items: RawItem[]; raw: string };

export async function callOperation(op: Operation, params: Record<string, string | number | undefined>): Promise<ApiResult> {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const url = `${apiBase()}/${op}?serviceKey=${serviceKeyParam()}${qs ? `&${qs}` : ''}`;

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const raw = await res.text();
  // Gateway errors come back as <OpenAPI_ServiceResponse><cmmMsgHeader>… or JSON.
  const resultCode = tag(raw, 'resultCode') ?? tag(raw, 'returnReasonCode');
  const resultMsg = tag(raw, 'resultMsg') ?? tag(raw, 'returnAuthMsg') ?? tag(raw, 'errMsg');
  const totalCount = Number(tag(raw, 'totalCount') ?? NaN);
  const ok = res.ok && (resultCode === '00' || resultCode === '0' || resultCode === null) && !/<cmmMsgHeader>/.test(raw);
  return { ok, resultCode, resultMsg, totalCount: Number.isFinite(totalCount) ? totalCount : null, items: parseItems(raw), raw };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function pick(item: RawItem, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = item[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function ymd(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/[^0-9]/g, '');
  if (d.length < 8) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function int(v: string | null): number | null {
  if (v === null) return null;
  const n = parseInt(v.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function hour(v: string | null): number | null {
  if (v === null) return null;
  const digits = v.replace(/[^0-9]/g, '');
  if (!digits) return null;
  // "9", "09", "0900", "09:00"
  const h = digits.length >= 3 ? parseInt(digits.slice(0, digits.length - 2), 10) : parseInt(digits, 10);
  return Number.isFinite(h) && h >= 0 && h <= 24 ? h : null;
}

function yn(v: string | null): boolean | null {
  if (v === null) return null;
  const s = v.toUpperCase();
  if (s === 'Y' || s === '1' || s === 'TRUE') return true;
  if (s === 'N' || s === '0' || s === 'FALSE') return false;
  return null;
}

export function normalizeProgram(item: RawItem): VolunteerProgram | null {
  const id = pick(item, 'progrmRegistNo', 'progrmRegistNo1');
  const title = pick(item, 'progrmSj', 'progrmNm');
  if (!id || !title) return null;
  return {
    id,
    title,
    status: int(pick(item, 'progrmSttusSe', 'progrmSttus')),
    program_start: ymd(pick(item, 'progrmBgnde', 'actBgnde')),
    program_end: ymd(pick(item, 'progrmEndde', 'actEndde')),
    act_begin_hour: hour(pick(item, 'actBeginTm', 'actBgnTm')),
    act_end_hour: hour(pick(item, 'actEndTm')),
    notice_start: ymd(pick(item, 'noticeBgnde')),
    notice_end: ymd(pick(item, 'noticeEndde')),
    recruit_count: int(pick(item, 'rcritNmpr')),
    applied_count: int(pick(item, 'appTotal', 'appNmpr')),
    act_weekdays: pick(item, 'actWkdy'),
    category: pick(item, 'srvcClCode', 'srvcClNm'),
    adult_ok: yn(pick(item, 'adultPosblAt')),
    youth_ok: yn(pick(item, 'yngbgsPosblAt')),
    group_ok: yn(pick(item, 'grpPosblAt')),
    org_name: pick(item, 'mnnstNm', 'nanmmbyNm'),
    registrar_name: pick(item, 'nanmmbyNm'),
    place: pick(item, 'actPlace', 'actPlce'),
    contact_name: pick(item, 'nanmmbyNmAdmn', 'chargeNm'),
    contact_phone: pick(item, 'telno', 'telNo'),
    contact_email: pick(item, 'email'),
    description: pick(item, 'progrmCn'),
    sido_code: pick(item, 'sidoCd', 'schSido'),
    gugun_code: pick(item, 'gugunCd', 'schSign1'),
    detail_url: signupUrl(id),
  };
}

// ---------------------------------------------------------------------------
// Sync (daily cron)
// ---------------------------------------------------------------------------

const DETAIL_BUDGET_PER_RUN = 150; // dev account allows 1,000 calls/day per operation
const LOOKAHEAD_DAYS = 21;

function yyyymmdd(date: Date): string {
  return kstDateString(date).replace(/-/g, '');
}

export async function syncVolunteerPrograms() {
  const admin = getAdmin();
  const now = new Date();
  const from = yyyymmdd(now);
  const to = yyyymmdd(new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000));
  const report: Record<string, unknown>[] = [];

  for (const city of VOLUNTEER_CITIES) {
    const seen: VolunteerProgram[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await callOperation('getVltrSearchWordList', {
        keyword: city.keyword,
        schCateGu: 'all',
        progrmBgnde: from,
        progrmEndde: to,
        adultPosblAt: 'Y',
        numOfRows: 100,
        pageNo: page,
      });
      if (!res.ok) {
        report.push({ city: city.slug, page, error: `${res.resultCode} ${res.resultMsg}` });
        break;
      }
      for (const item of res.items) {
        const p = normalizeProgram(item);
        if (p) seen.push(p);
      }
      if (res.items.length < 100) break;
    }

    const listedAt = new Date().toISOString();
    if (seen.length > 0) {
      const rows = seen.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        program_start: p.program_start,
        program_end: p.program_end,
        org_name: p.org_name,
        adult_ok: p.adult_ok ?? true, // came from an adult-only search
        city: city.slug,
        detail_url: p.detail_url,
        listed_at: listedAt,
      }));
      const { error } = await admin.from('volunteer_programs').upsert(rows, { onConflict: 'id' });
      if (error) report.push({ city: city.slug, upsert_error: error.message });
    }
    report.push({ city: city.slug, listed: seen.length });
  }

  // Details (counts, times, place) for programs still recruiting, stalest first.
  const staleBefore = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: needDetail } = await admin
    .from('volunteer_programs')
    .select('id, city')
    .gte('program_end', kstDateString())
    .or(`detail_fetched_at.is.null,detail_fetched_at.lt.${staleBefore}`)
    .order('detail_fetched_at', { ascending: true, nullsFirst: true })
    .limit(DETAIL_BUDGET_PER_RUN);

  let detailed = 0;
  const detailErrors: string[] = [];
  for (const row of needDetail ?? []) {
    const res = await callOperation('getVltrPartcptnItem', { progrmRegistNo: row.id as string });
    const item = res.items[0];
    const p = item ? normalizeProgram(item) : null;
    if (!res.ok || !p) {
      detailErrors.push(`${row.id}: ${res.resultCode ?? ''} ${res.resultMsg ?? 'no item'}`);
      await admin.from('volunteer_programs').update({ detail_fetched_at: new Date().toISOString() }).eq('id', row.id);
      continue;
    }
    const { id: _id, ...fields } = p;
    void _id;
    await admin
      .from('volunteer_programs')
      .update({ ...fields, city: row.city, raw: item, detail_fetched_at: new Date().toISOString() })
      .eq('id', row.id);
    detailed++;
  }

  return { ok: true as const, report, detailed, detail_errors: detailErrors.slice(0, 20) };
}
