import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { deleteExpiredProofs } from '@/lib/server/consents';

export const maxDuration = 120;

/** Cron (daily): delete group selfies and 1365 certificates past the retention period. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await deleteExpiredProofs());
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
