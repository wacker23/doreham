import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { sendCheckInReminders } from '@/lib/server/scheduling';

export const maxDuration = 60;

/** Cron (every 15 min): "your meetup starts soon — check in" within the hour before start. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await sendCheckInReminders());
}

export const GET = handle;
export const POST = handle;
