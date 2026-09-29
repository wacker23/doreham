import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { syncVolunteerPrograms } from '@/lib/server/volunteer1365';

export const maxDuration = 300;

/** Cron (twice daily): refresh cached 1365 volunteer programs for supported cities. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await syncVolunteerPrograms());
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
