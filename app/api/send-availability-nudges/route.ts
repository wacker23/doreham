import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET/POST /api/send-availability-nudges
 *
 * Runs daily via cron at 1am UTC (10am KST).
 * Finds groups where:
 *   - phase = 'availability'
 *   - activated_at is 24h+ ago
 * For each active member who hasn't submitted availability AND hasn't been nudged yet,
 * sends a notification (no email).
 * Tracks via group_members.availability_nudge_sent_at.
 */

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find groups stalled in availability
    const { data: stalledGroups } = await admin
      .from('groups')
      .select('id, activated_at')
      .eq('phase', 'availability')
      .lt('activated_at', cutoff);

    if (!stalledGroups || stalledGroups.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'No stalled availability groups' });
    }

    const results: any[] = [];

    for (const group of stalledGroups) {
      const result = await nudgeGroup(admin, group.id);
      results.push({ group_id: group.id, ...result });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function nudgeGroup(admin: any, groupId: string) {
  // Get all active accepted members who haven't been nudged yet
  const { data: members } = await admin
    .from('group_members')
    .select('user_id, availability_nudge_sent_at')
    .eq('group_id', groupId)
    .eq('invite_state', 'accepted')
    .is('left_at', null)
    .is('availability_nudge_sent_at', null);

  if (!members || members.length === 0) {
    return { action: 'skipped', reason: 'No un-nudged members' };
  }

  // Get who has already submitted availability
  const { data: submissions } = await admin
    .from('availability_submissions')
    .select('user_id')
    .eq('group_id', groupId);

  const submittedIds = new Set((submissions ?? []).map((s: any) => s.user_id));
  const needNudge = members.filter((m: any) => !submittedIds.has(m.user_id));

  if (needNudge.length === 0) {
    return { action: 'skipped', reason: 'All members already submitted' };
  }

  // Get venue name for context
  const { data: quest } = await admin
    .from('quests')
    .select('venue:venues!inner(business_name_display)')
    .eq('group_id', groupId)
    .maybeSingle();

  const venueName = (quest?.venue as any)?.business_name_display ?? 'your meetup';

  // Create notifications
  const notifPayload = needNudge.map((m: any) => ({
    user_id: m.user_id,
    type: 'availability_reminder' as const,
    title_en: `⏰ Your group is waiting for you`,
    title_ko: `⏰ 그룹이 기다리고 있어요`,
    body_en: `Pick your available times for the meetup at ${venueName}. Your group can't schedule without you!`,
    body_ko: `${venueName}에서의 만남을 위한 가능한 시간을 선택해주세요. 여러분 없이는 일정을 잡을 수 없어요!`,
    action_url: `/matches/${groupId}/availability`,
    is_important: true,
  }));

  await admin.from('notifications').insert(notifPayload);

  // Mark nudged
  const nowIso = new Date().toISOString();
  for (const m of needNudge) {
    await admin
      .from('group_members')
      .update({ availability_nudge_sent_at: nowIso })
      .eq('group_id', groupId)
      .eq('user_id', m.user_id);
  }

  return {
    action: 'nudged',
    nudged_count: needNudge.length,
    venue: venueName,
  };
}