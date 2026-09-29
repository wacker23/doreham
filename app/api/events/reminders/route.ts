import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { deleteOrphanPosters, sendEventReminders, translatePendingEvents } from '@/lib/server/events';

export const maxDuration = 120;

/** Cron (daily, 9am KST): remind people going to today's events; catch up on translations; delete orphaned posters. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const reminders = await sendEventReminders();
    const translations = await translatePendingEvents(20);
    const posters = await deleteOrphanPosters();
    return NextResponse.json({ ok: true, reminders, translations, posters });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
