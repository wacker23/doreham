import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/lock-quest-date
 * body: { group_id: string }
 *
 * Called when:
 * - Every group member has voted (early close per Q5 rule)
 * - OR voting deadline has passed
 *
 * Tallies votes, applies tie-breaker (weekend > weekday, evening > afternoon > morning),
 * sets quest_scheduled_at, transitions phase to 'scheduled'.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Tie-breaker scoring per Q5 rule:
 * - Weekend (Sat/Sun) beats weekday
 * - Evening (18-23) > afternoon (12-17) > morning (0-11)
 * Higher score wins.
 */
function scoreSlot(iso: string): number {
  const d = new Date(iso);
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = d.getHours();

  let score = 0;
  // Weekend bonus
  if (day === 0 || day === 6) score += 100;
  // Time-of-day bonus
  if (hour >= 18) score += 30;
  else if (hour >= 12) score += 20;
  else score += 10;
  return score;
}

export async function POST(request: Request) {
  try {
    const { group_id } = await request.json();
    if (!group_id) {
      return NextResponse.json({ error: 'group_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: group, error: groupErr } = await admin
      .from('groups')
      .select('id, phase, voting_phase_ends_at, quest_scheduled_at')
      .eq('id', group_id)
      .maybeSingle();

    if (groupErr || !group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.phase !== 'voting') {
      return NextResponse.json({ ok: true, phase: group.phase, note: 'Not in voting phase' });
    }

    // Load members
    const { data: members } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .is('left_at', null)
      .not('accepted_at', 'is', null);

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No members' }, { status: 400 });
    }

    // Load votes
    const { data: votes } = await admin
      .from('date_votes')
      .select('user_id, candidate_slot_id')
      .eq('group_id', group_id);

    const votingEnd = group.voting_phase_ends_at ? new Date(group.voting_phase_ends_at) : null;
    const votingClosed = votingEnd ? Date.now() >= votingEnd.getTime() : false;
    const allVoted = votes && votes.length >= members.length;

    // Only proceed if all voted OR deadline passed
    if (!allVoted && !votingClosed) {
      return NextResponse.json({
        ok: true,
        phase: 'voting',
        note: 'Voting still open',
        voted: votes?.length ?? 0,
        total: members.length,
      });
    }

    // Load candidate slots
    const { data: candidates } = await admin
      .from('candidate_slots')
      .select('id, slot_time')
      .eq('group_id', group_id);

    if (!candidates || candidates.length === 0) {
      // No candidates? Shouldn't happen, but cancel
      await admin.from('groups').update({ phase: 'cancelled' }).eq('id', group_id);
      return NextResponse.json({ ok: true, phase: 'cancelled', note: 'No candidates' });
    }

    // Tally votes per candidate
    const voteCounts: Record<string, number> = {};
    (votes ?? []).forEach((v: any) => {
      voteCounts[v.candidate_slot_id] = (voteCounts[v.candidate_slot_id] ?? 0) + 1;
    });

    // Find winning candidate(s) — highest vote count
    const maxVotes = Math.max(0, ...Object.values(voteCounts));

    let winnersIds: string[];
    if (maxVotes === 0) {
      // No votes at all → tie-breaker across ALL candidates
      winnersIds = candidates.map((c) => c.id);
    } else {
      winnersIds = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVotes)
        .map(([id]) => id);
    }

    let winningSlot: { id: string; slot_time: string };
    if (winnersIds.length === 1) {
      const found = candidates.find((c) => c.id === winnersIds[0])!;
      winningSlot = { id: found.id, slot_time: found.slot_time };
    } else {
      // Tie-breaker: apply score, highest wins. If still tied, earliest wins.
      const tiedCandidates = candidates
        .filter((c) => winnersIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          slot_time: c.slot_time,
          score: scoreSlot(c.slot_time),
        }));

      tiedCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.slot_time).getTime() - new Date(b.slot_time).getTime();
      });

      winningSlot = tiedCandidates[0];
    }

    // Lock it in
    await admin
      .from('groups')
      .update({
        phase: 'scheduled',
        quest_scheduled_at: winningSlot.slot_time,
      })
      .eq('id', group_id);

    // Update quest status
    await admin
      .from('quests')
      .update({ status: 'scheduled', scheduled_at: winningSlot.slot_time })
      .eq('group_id', group_id);

    return NextResponse.json({
      ok: true,
      phase: 'scheduled',
      scheduled_at: winningSlot.slot_time,
      winning_slot_id: winningSlot.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}