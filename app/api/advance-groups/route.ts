import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { advanceDueGroups } from '@/lib/server/scheduling';

export const maxDuration = 120;

/**
 * Cron (every 15 min): moves groups forward when a deadline passes, even if
 * nobody opens the app — availability → voting → scheduled → completed.
 */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await advanceDueGroups());
}

export const GET = handle;
export const POST = handle;
