import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { sendAvailabilityNudges } from '@/lib/server/scheduling';
import { sendVolunteerSignupNudges } from '@/lib/server/volunteer';

export const maxDuration = 60;

/** Cron (hourly): nudge members who haven't picked times, and volunteers who haven't confirmed their 1365 signup. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  const [availability, volunteerSignup] = await Promise.all([sendAvailabilityNudges(), sendVolunteerSignupNudges()]);
  return NextResponse.json({ ok: true, availability, volunteer_signup: volunteerSignup });
}

export const GET = handle;
export const POST = handle;
