import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/close-expired-quests
 * GET  /api/close-expired-quests  (Vercel Cron uses GET)
 *
 * Called via daily cron. Finds all quests where:
 *   - status = 'scheduled'
 *   - check-in window has fully closed (scheduled_at + 2h < now)
 *
 * For each:
 *   - Count check-ins
 *   - If >= 2: mark quest completed, assign no_show strikes to absent members
 *   - If < 2: mark quest failed (cancelled), no strikes issued
 *   - Free all members (mark left_at)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CHECK_IN_WINDOW_AFTER_MIN = 120;
const MIN_CHECK_INS_TO_COMPLETE = 2;

// Vercel Cron sends GET — forward to the same logic
export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find scheduled quests whose window has closed
    const cutoff = new Date(Date.now() - CHECK_IN_WINDOW_AFTER_MIN * 60 * 1000).toISOString();

    const { data: expiredGroups } = await admin
      .from('groups')
      .select('id, quest_scheduled_at, phase')
      .eq('phase', 'scheduled')
      .lt('quest_scheduled_at', cutoff);

    if (!expiredGroups || expiredGroups.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'No expired quests' });
    }

    const results: any[] = [];

    for (const group of expiredGroups) {
      const result = await closeGroup(admin, group.id);
      results.push({ group_id: group.id, ...result });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function closeGroup(admin: any, groupId: string) {
  // Get quest
  const { data: quest } = await admin
    .from('quests')
    .select('id, status')
    .eq('group_id', groupId)
    .maybeSingle();

  if (!quest || quest.status !== 'scheduled') {
    return { action: 'skipped', reason: 'Quest not in scheduled state' };
  }

  // Get all active members
  const { data: members } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .is('left_at', null);

  if (!members || members.length === 0) {
    return { action: 'skipped', reason: 'No active members' };
  }

  // Get who checked in
  const { data: checkIns } = await admin
    .from('quest_check_ins')
    .select('user_id')
    .eq('quest_id', quest.id);

  const checkedInIds = new Set((checkIns ?? []).map((c: any) => c.user_id));
  const checkInCount = checkedInIds.size;
  const absentMembers = members.filter((m: any) => !checkedInIds.has(m.user_id));

  // Decide: completed or failed?
  if (checkInCount >= MIN_CHECK_INS_TO_COMPLETE) {
    // Complete the quest
    await admin.from('quests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', quest.id);

    await admin.from('groups').update({
      phase: 'scheduled', // Keep phase — it was completed successfully
    }).eq('id', groupId);

    // Issue no_show strikes for absent members
    for (const absent of absentMembers) {
      const { data: currentPenalties } = await admin
        .from('user_penalties')
        .select('strike_number')
        .eq('user_id', absent.user_id)
        .order('strike_number', { ascending: false })
        .limit(1);

      const nextStrike = (currentPenalties?.[0]?.strike_number ?? 0) + 1;

      let freezeUntil: string | null = null;
      if (nextStrike >= 4) {
        freezeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (nextStrike === 3) {
        freezeUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      }

      await admin.from('user_penalties').insert({
        user_id: absent.user_id,
        reason: 'no_show',
        strike_number: nextStrike,
        freeze_until: freezeUntil,
        notes: `No-show for quest ${quest.id} (group ${groupId})`,
      });
    }

    // Free all members
    await admin.from('group_members').update({
      left_at: new Date().toISOString(),
    }).eq('group_id', groupId).is('left_at', null);

    return {
      action: 'completed',
      check_in_count: checkInCount,
      absent_count: absentMembers.length,
      strikes_issued: absentMembers.length,
    };
  } else {
    // Quest failed — not enough people showed up
    await admin.from('quests').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    }).eq('id', quest.id);

    await admin.from('groups').update({
      phase: 'cancelled',
    }).eq('id', groupId);

    // Free everyone (no strikes — the ones who tried to show up shouldn't be penalized)
    await admin.from('group_members').update({
      left_at: new Date().toISOString(),
    }).eq('group_id', groupId).is('left_at', null);

    return {
      action: 'failed',
      check_in_count: checkInCount,
      needed: MIN_CHECK_INS_TO_COMPLETE,
      note: 'Not enough check-ins',
    };
  }
}
