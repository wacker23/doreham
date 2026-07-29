import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/compute-candidates
 * body: { group_id: string }
 *
 * Called lazily when someone visits /matches or /matches/[id]/availability
 * after T+24h has passed. Checks phase, computes intersection, transitions
 * group from 'availability' -> 'voting' (or 'cancelled' if no overlap).
 * Idempotent — safe to call repeatedly.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { group_id } = await request.json();
    if (!group_id) {
      return NextResponse.json({ error: 'group_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Load group
    const { data: group, error: groupErr } = await admin
      .from('groups')
      .select('id, phase, availability_phase_ends_at, created_at')
      .eq('id', group_id)
      .maybeSingle();

    if (groupErr || !group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Only proceed if phase is 'availability' and deadline has passed
    if (group.phase !== 'availability') {
      return NextResponse.json({ ok: true, phase: group.phase, note: 'Already transitioned' });
    }

    const phaseEnd = group.availability_phase_ends_at
      ? new Date(group.availability_phase_ends_at)
      : new Date(new Date(group.created_at).getTime() + 24 * 60 * 60 * 1000);

    // Check if we can transition early — all members submitted
    const { data: memberCheck } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .is('left_at', null)
      .not('accepted_at', 'is', null);

    const { data: subCheck } = await admin
      .from('availability_submissions')
      .select('user_id')
      .eq('group_id', group_id);

    const allSubmitted = memberCheck && subCheck && subCheck.length >= memberCheck.length;

    if (Date.now() < phaseEnd.getTime() && !allSubmitted) {
      return NextResponse.json({ ok: true, phase: 'availability', note: 'Phase still active, waiting for more submissions' });
    }

    // Load all members
    const { data: members } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .is('left_at', null)
      .not('accepted_at', 'is', null);

    if (!members || members.length === 0) {
      // No members, cancel
      await admin.from('groups').update({ phase: 'cancelled' }).eq('id', group_id);
      return NextResponse.json({ ok: true, phase: 'cancelled', note: 'No members' });
    }

    const memberIds = new Set(members.map((m) => m.user_id));

    // Load submissions
    const { data: submissions } = await admin
      .from('availability_submissions')
      .select('user_id, slots')
      .eq('group_id', group_id);

    const submittedUsers = new Set((submissions ?? []).map((s: any) => s.user_id));

    // Q3 rule: If only 0 or 1 submitted, cancel
    if (submittedUsers.size < 2) {
      await admin.from('groups').update({ phase: 'cancelled' }).eq('id', group_id);
      return NextResponse.json({ ok: true, phase: 'cancelled', note: 'Not enough submissions' });
    }

    // For each slot, find which users are available
    // Q6 rule: Users who didn't submit are dropped from THIS calc (they can still vote later per Sophia's spec)
    // Actually Sophia said "they stay in group and also able to do the quest" — so non-submitters can still participate
    // We use only SUBMITTED users to find intersection, but the whole group can still vote
    const slotToUsers: Record<string, string[]> = {};
    (submissions ?? []).forEach((sub: any) => {
      (sub.slots as string[]).forEach((slot) => {
        if (!slotToUsers[slot]) slotToUsers[slot] = [];
        slotToUsers[slot].push(sub.user_id);
      });
    });

    // A candidate slot needs ALL submitters available
    // (users who didn't submit aren't counted for/against — they can vote either way)
    const submittedUserCount = submittedUsers.size;
    const candidates: { slot: string; users: string[] }[] = [];
    Object.entries(slotToUsers).forEach(([slot, users]) => {
      if (users.length === submittedUserCount) {
        candidates.push({ slot, users });
      }
    });

    // Q4 rule: no common slot → cancel
    if (candidates.length === 0) {
      await admin.from('groups').update({ phase: 'cancelled' }).eq('id', group_id);
      return NextResponse.json({ ok: true, phase: 'cancelled', note: 'No overlapping slot' });
    }

    // Insert candidate slots (upsert-safe via unique constraint)
    const candidateRows = candidates.map((c) => ({
      group_id,
      slot_time: c.slot,
      available_user_ids: c.users,
    }));

    // Clear old candidates for this group first (idempotent)
    await admin.from('candidate_slots').delete().eq('group_id', group_id);

    const { error: insertErr } = await admin.from('candidate_slots').insert(candidateRows);
    if (insertErr) {
      return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 });
    }

    // Transition phase to voting
    // Voting phase ends 24h from now (but per Q5 rule, closes early when everyone votes)
    const votingEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from('groups')
      .update({ phase: 'voting', voting_phase_ends_at: votingEnd })
      .eq('id', group_id);

    return NextResponse.json({
      ok: true,
      phase: 'voting',
      candidate_count: candidates.length,
      voting_ends_at: votingEnd,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}