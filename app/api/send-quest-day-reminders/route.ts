import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

/**
 * GET/POST /api/send-quest-day-reminders
 *
 * Runs daily via cron at 0am UTC (9am KST).
 * Finds all groups with:
 *   - phase = 'scheduled'
 *   - quest_scheduled_at is on TODAY (KST)
 *   - quest is scheduled (not completed or cancelled)
 *
 * For each active member, creates a notification + fires email.
 * Tracks sent reminders via a "reminders_sent" flag on the group
 * to avoid duplicates.
 */

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Compute today's window in KST (UTC+9)
    // Cron runs at 0am UTC = 9am KST, so "today KST" is roughly [now, now+15h)
    // We want quests scheduled between 9am KST today and end of day KST
    const now = new Date();
    const startOfWindow = new Date(now.getTime());
    const endOfWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24h

    // Find scheduled groups with quests today
    const { data: groups } = await admin
      .from('groups')
      .select('id, quest_scheduled_at, quest_day_reminded_at')
      .eq('phase', 'scheduled')
      .gte('quest_scheduled_at', startOfWindow.toISOString())
      .lt('quest_scheduled_at', endOfWindow.toISOString())
      .is('quest_day_reminded_at', null); // Not already reminded

    if (!groups || groups.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'No quests happening today' });
    }

    const results: any[] = [];

    for (const group of groups) {
      const result = await processGroup(admin, group.id, group.quest_scheduled_at);
      results.push({ group_id: group.id, ...result });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function processGroup(admin: any, groupId: string, scheduledAt: string) {
  // Get venue info
  const { data: quest } = await admin
    .from('quests')
    .select('venue:venues!inner(business_name_display)')
    .eq('group_id', groupId)
    .maybeSingle();

  if (!quest) return { action: 'skipped', reason: 'No quest' };

  const venueName = (quest.venue as any)?.business_name_display ?? 'the venue';

  // Get active members (accepted, not left)
  const { data: members } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('invite_state', 'accepted')
    .is('left_at', null);

  if (!members || members.length === 0) {
    return { action: 'skipped', reason: 'No active members' };
  }

  // Create notification + email for each member
  const notificationsPayload = members.map((m: any) => ({
    user_id: m.user_id,
    type: 'quest_day_reminder' as const,
    title_en: `🗓️ Your meetup at ${venueName} is today!`,
    title_ko: `🗓️ 오늘 ${venueName}에서 만나요!`,
    body_en: `Get ready — scan the QR at ${venueName} to check in when you arrive.`,
    body_ko: `준비하세요 — ${venueName}에 도착하면 QR 코드를 스캔해서 체크인하세요.`,
    action_url: '/matches',
    is_important: true,
  }));

  await admin.from('notifications').insert(notificationsPayload);

  // Fire emails (fire-and-forget)
  for (const m of members) {
    fetch(`${APP_URL}/api/emails/quest-day-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: m.user_id,
        venue_name: venueName,
        scheduled_at: scheduledAt,
      }),
    }).catch((e) => console.error('Quest-day email failed (non-fatal):', e));
  }

  // Mark as reminded so we don't send again
  await admin
    .from('groups')
    .update({ quest_day_reminded_at: new Date().toISOString() })
    .eq('id', groupId);

  return {
    action: 'reminded',
    members_count: members.length,
    venue: venueName,
  };
}