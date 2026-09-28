import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { sendAvailabilityNudges } from '@/lib/server/scheduling';

export const maxDuration = 60;

/** Cron (hourly): nudge members who haven't picked times 12h after the group was confirmed. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await sendAvailabilityNudges());
}

export const GET = handle;
export const POST = handle;
