import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { ALLOWED_OPERATIONS, callOperation, normalizeProgram, type Operation } from '@/lib/server/volunteer1365';

/**
 * Admin / cron only. Calls one 1365 operation with the given query params and returns the raw
 * response plus what our parser makes of it — used to verify field names against the live API.
 *   GET /api/admin/volunteer-probe?op=getVltrSearchWordList&keyword=아산&numOfRows=5
 */
export async function GET(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const op = url.searchParams.get('op') as Operation | null;
  if (!op || !ALLOWED_OPERATIONS.includes(op)) {
    return NextResponse.json({ error: `op must be one of ${ALLOWED_OPERATIONS.join(', ')}` }, { status: 400 });
  }
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k !== 'op' && k.toLowerCase() !== 'servicekey') params[k] = v;
  });

  try {
    const res = await callOperation(op, params);
    return NextResponse.json({
      ok: res.ok,
      resultCode: res.resultCode,
      resultMsg: res.resultMsg,
      totalCount: res.totalCount,
      item_count: res.items.length,
      first_item_raw: res.items[0] ?? null,
      first_item_normalized: res.items[0] ? normalizeProgram(res.items[0]) : null,
      raw_head: res.raw.slice(0, 3000),
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
