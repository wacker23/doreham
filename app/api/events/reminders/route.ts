import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { sendEventReminders, translatePendingEvents } from '@/lib/server/events';

export const maxDuration = 120;

/** Cron (daily, 9am KST): remind people going to today's events; catch up on translations. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const [reminders, translations] = [await sendEventReminders(), await translatePendingEvents(20)];
    return NextResponse.json({ ok: true, reminders, translations });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
