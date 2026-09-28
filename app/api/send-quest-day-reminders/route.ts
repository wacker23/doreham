import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { sendQuestDayReminders } from '@/lib/server/scheduling';

export const maxDuration = 60;

/** Cron (daily 9am KST): reminder notification + email for meetups in the next 24h. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await sendQuestDayReminders());
}

export const GET = handle;
export const POST = handle;
