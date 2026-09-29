import 'server-only';
import { after } from 'next/server';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotifications } from '@/lib/notifications';
import { cancelActiveGroup, isAccepted } from '@/lib/server/groupLifecycle';
import { issueStrike } from '@/lib/server/strikes';
import { formatKst, hoursFromNow, kstDayHour } from '@/lib/server/time';
import { sendQuestDayReminderEmail } from '@/lib/server/emails/quest-day-reminder';
import {
  closeExpiredVolunteerQuests,
  closeVolunteerSignups,
  onVolunteerSlotLocked,
  startVolunteerVoting,
} from '@/lib/server/volunteer';

/**
 * Scheduling pipeline for an active group:
 *   availability (24h, or until everyone submits) → voting (24h, or until everyone votes)
 *   → scheduled → check-in window (-40 min … +2 h) → completed / cancelled
 *
 * These functions are idempotent and are called both lazily from the UI and
 * from the /api/advance-groups cron, so groups progress even if nobody opens the app.
 */

export const VOTING_PHASE_HOURS = 24;
export const CHECK_IN_WINDOW_BEFORE_MIN = 40;
export const CHECK_IN_WINDOW_AFTER_MIN = 120;
export const MIN_CHECK_INS_TO_COMPLETE = 2;

async function activeMemberIds(groupId: string): Promise<string[]> {
  const { data } = await getAdmin()
    .from('group_members')
    .select('user_id, invite_state, accepted_at, left_at')
    .eq('group_id', groupId)
    .is('left_at', null);
  return (data ?? []).filter(isAccepted).map((m) => m.user_id as string);
}

// ---------------------------------------------------------------------------
// availability → voting
// ---------------------------------------------------------------------------

export async function computeCandidates(groupId: string) {
  const admin = getAdmin();
  const { data: group } = await admin
    .from('groups')
    .select('id, phase, is_pending_invites, availability_phase_ends_at, activated_at, created_at')
    .eq('id', groupId)
    .maybeSingle();

  if (!group) return { ok: false as const, status: 404, error: 'group_not_found' };
  if (group.is_pending_invites) return { ok: true as const, phase: 'pending_invites', note: 'Waiting for invites' };
  if (group.phase !== 'availability') return { ok: true as const, phase: group.phase, note: 'Already transitioned' };

  const phaseEnd = group.availability_phase_ends_at
    ? new Date(group.availability_phase_ends_at)
    : new Date(new Date(group.activated_at ?? group.created_at).getTime() + 24 * 60 * 60 * 1000);

  const members = await activeMemberIds(groupId);
  const { data: submissions } = await admin
    .from('availability_submissions')
    .select('user_id, slots')
    .eq('group_id', groupId);
  const memberSet = new Set(members);
  const relevant = (submissions ?? []).filter((s) => memberSet.has(s.user_id as string));
  const allSubmitted = members.length > 0 && relevant.length >= members.length;

  if (Date.now() < phaseEnd.getTime() && !allSubmitted) {
    return { ok: true as const, phase: 'availability', note: 'Phase still active, waiting for more submissions' };
  }

  if (members.length < 2) {
    await cancelActiveGroup(groupId, {
      en: 'Not enough members are left in the group.',
      ko: '그룹에 남은 멤버가 부족해요.',
    });
    return { ok: true as const, phase: 'cancelled', note: 'Not enough members' };
  }

  const submittedUsers = new Set(relevant.map((s) => s.user_id as string));
  if (submittedUsers.size < 2) {
    await cancelActiveGroup(groupId, {
      en: 'Fewer than two people shared their available times.',
      ko: '가능한 시간을 제출한 사람이 두 명 미만이었어요.',
    });
    return { ok: true as const, phase: 'cancelled', note: 'Not enough submissions' };
  }

  // A candidate slot needs every submitter to be free. Non-submitters can still vote.
  const slotToUsers: Record<string, string[]> = {};
  for (const sub of relevant) {
    for (const slot of (sub.slots as string[]) ?? []) {
      // Only future slots are useful.
      if (new Date(slot).getTime() <= Date.now()) continue;
      (slotToUsers[slot] ??= []).push(sub.user_id as string);
    }
  }
  const candidates = Object.entries(slotToUsers)
    .filter(([, users]) => users.length === submittedUsers.size)
    .map(([slot, users]) => ({ group_id: groupId, slot_time: slot, available_user_ids: users }));

  if (candidates.length === 0) {
    await cancelActiveGroup(groupId, {
      en: "There wasn't a time that worked for everyone.",
      ko: '모두가 가능한 시간이 없었어요.',
    });
    return { ok: true as const, phase: 'cancelled', note: 'No overlapping slot' };
  }

  // Conditional transition so only one caller writes candidates.
  const votingEnd = hoursFromNow(VOTING_PHASE_HOURS);
  const { data: won } = await admin
    .from('groups')
    .update({ phase: 'voting', voting_phase_ends_at: votingEnd })
    .eq('id', groupId)
    .eq('phase', 'availability')
    .select('id');
  if (!won || won.length === 0) return { ok: true as const, phase: 'voting', note: 'Already transitioned' };

  await admin.from('candidate_slots').delete().eq('group_id', groupId);
  const { error: insertErr } = await admin.from('candidate_slots').insert(candidates);
  if (insertErr) {
    await admin.from('groups').update({ phase: 'availability' }).eq('id', groupId);
    return { ok: false as const, status: 500, error: `Insert failed: ${insertErr.message}` };
  }

  after(async () => {
    await createNotifications(
      members.map((uid) => ({
        user_id: uid,
        type: 'availability_reminder' as const,
        title_en: '🗳️ Time to vote on your meetup time',
        title_ko: '🗳️ 만날 시간을 투표해 주세요',
        body_en: `We found ${candidates.length} time${candidates.length === 1 ? '' : 's'} that work for everyone. Vote within 24 hours.`,
        body_ko: `모두가 가능한 시간 ${candidates.length}개를 찾았어요. 24시간 안에 투표해 주세요.`,
        action_url: `/matches/${groupId}/availability`,
        is_important: true,
      })),
    );
  });

  return { ok: true as const, phase: 'voting', candidate_count: candidates.length, voting_ends_at: votingEnd };
}

// ---------------------------------------------------------------------------
// voting → scheduled
// ---------------------------------------------------------------------------

/** Tie-breaker (KST): weekend beats weekday; evening > afternoon > morning. */
function scoreSlot(iso: string): number {
  const { day, hour } = kstDayHour(iso);
  let score = 0;
  if (day === 0 || day === 6) score += 100;
  if (hour >= 18) score += 30;
  else if (hour >= 12) score += 20;
  else score += 10;
  return score;
}

export async function lockQuestDate(groupId: string) {
  const admin = getAdmin();
  const { data: group } = await admin
    .from('groups')
    .select('id, phase, voting_phase_ends_at, quest_type')
    .eq('id', groupId)
    .maybeSingle();

  if (!group) return { ok: false as const, status: 404, error: 'group_not_found' };
  if (group.phase !== 'voting') return { ok: true as const, phase: group.phase, note: 'Not in voting phase' };

  const members = await activeMemberIds(groupId);
  if (members.length < 2) {
    await cancelActiveGroup(groupId, {
      en: 'Not enough members are left in the group.',
      ko: '그룹에 남은 멤버가 부족해요.',
    });
    return { ok: true as const, phase: 'cancelled', note: 'Not enough members' };
  }

  const { data: votesRaw } = await admin.from('date_votes').select('user_id, candidate_slot_id').eq('group_id', groupId);
  const memberSet = new Set(members);
  const votes = (votesRaw ?? []).filter((v) => memberSet.has(v.user_id as string));

  const votingClosed = group.voting_phase_ends_at ? Date.now() >= new Date(group.voting_phase_ends_at).getTime() : false;
  const allVoted = votes.length >= members.length;
  if (!allVoted && !votingClosed) {
    return { ok: true as const, phase: 'voting', note: 'Voting still open', voted: votes.length, total: members.length };
  }

  const { data: candidatesRaw } = await admin.from('candidate_slots').select('id, slot_time').eq('group_id', groupId);
  const candidates = (candidatesRaw ?? []).filter((c) => new Date(c.slot_time as string).getTime() > Date.now());
  if (candidates.length === 0) {
    await cancelActiveGroup(groupId, {
      en: 'All proposed times have passed.',
      ko: '제안된 시간이 모두 지났어요.',
    });
    return { ok: true as const, phase: 'cancelled', note: 'No future candidates' };
  }

  const voteCounts: Record<string, number> = {};
  for (const v of votes) voteCounts[v.candidate_slot_id as string] = (voteCounts[v.candidate_slot_id as string] ?? 0) + 1;
  const candidateIds = new Set(candidates.map((c) => c.id as string));
  const maxVotes = Math.max(0, ...Object.entries(voteCounts).filter(([id]) => candidateIds.has(id)).map(([, n]) => n));
  const winnersIds =
    maxVotes === 0
      ? candidates.map((c) => c.id as string)
      : Object.entries(voteCounts).filter(([id, n]) => n === maxVotes && candidateIds.has(id)).map(([id]) => id);

  const winning = candidates
    .filter((c) => winnersIds.includes(c.id as string))
    .map((c) => ({ id: c.id as string, slot_time: c.slot_time as string, score: scoreSlot(c.slot_time as string) }))
    .sort((a, b) => b.score - a.score || new Date(a.slot_time).getTime() - new Date(b.slot_time).getTime())[0];

  const { data: won } = await admin
    .from('groups')
    .update({ phase: 'scheduled', quest_scheduled_at: winning.slot_time })
    .eq('id', groupId)
    .eq('phase', 'voting')
    .select('id');
  if (!won || won.length === 0) return { ok: true as const, phase: 'scheduled', note: 'Already locked' };

  // NOTE: the column is scheduled_for (the old code wrote scheduled_at, which silently failed
  // and left every quest in 'proposed' so it could never auto-complete).
  const { error: questErr } = await admin
    .from('quests')
    .update({ status: 'scheduled', scheduled_for: winning.slot_time })
    .eq('group_id', groupId)
    .in('status', ['proposed', 'scheduled']);
  if (questErr) console.error('lockQuestDate quest update failed:', questErr);

  if (group.quest_type === 'volunteer') {
    // Volunteer groups now get a 1365 signup window (it sends its own notification).
    await onVolunteerSlotLocked(groupId, { id: winning.id, slot_time: winning.slot_time });
    return { ok: true as const, phase: 'scheduled', scheduled_at: winning.slot_time, winning_slot_id: winning.id };
  }

  after(async () => {
    await createNotifications(
      members.map((uid) => ({
        user_id: uid,
        type: 'quest_scheduled' as const,
        title_en: `📅 It's set: ${formatKst(winning.slot_time, 'en')}`,
        title_ko: `📅 확정: ${formatKst(winning.slot_time, 'ko')}`,
        body_en: "Your meetup time is locked in. Check in with the venue's QR code when you arrive.",
        body_ko: '만남 시간이 확정되었어요. 도착하면 매장의 QR 코드로 체크인하세요.',
        action_url: '/matches',
        is_important: true,
      })),
    );
  });

  return { ok: true as const, phase: 'scheduled', scheduled_at: winning.slot_time, winning_slot_id: winning.id };
}

// ---------------------------------------------------------------------------
// Close-out after the check-in window
// ---------------------------------------------------------------------------

export async function closeExpiredQuests() {
  const admin = getAdmin();
  const cutoff = new Date(Date.now() - CHECK_IN_WINDOW_AFTER_MIN * 60 * 1000).toISOString();
  const { data: groups } = await admin
    .from('groups')
    .select('id')
    .eq('phase', 'scheduled')
    .eq('quest_type', 'venue')
    .lt('quest_scheduled_at', cutoff);

  const results: Record<string, unknown>[] = [];
  for (const g of groups ?? []) results.push({ group_id: g.id, ...(await closeGroup(g.id as string)) });
  return { ok: true as const, processed: results.length, results };
}

async function closeGroup(groupId: string) {
  const admin = getAdmin();
  const { data: quest } = await admin.from('quests').select('id, status').eq('group_id', groupId).maybeSingle();
  if (!quest || !['proposed', 'scheduled'].includes(quest.status as string)) {
    return { action: 'skipped', reason: 'quest not open' };
  }

  const members = await activeMemberIds(groupId);
  const { data: checkIns } = await admin.from('quest_check_ins').select('user_id').eq('quest_id', quest.id);
  const checkedIn = new Set((checkIns ?? []).map((c) => c.user_id as string));
  const absent = members.filter((m) => !checkedIn.has(m));
  const now = new Date().toISOString();

  if (checkedIn.size >= MIN_CHECK_INS_TO_COMPLETE) {
    const { data: won } = await admin
      .from('groups')
      .update({ phase: 'completed', completed_at: now })
      .eq('id', groupId)
      .eq('phase', 'scheduled')
      .select('id');
    if (!won || won.length === 0) return { action: 'skipped', reason: 'already closed' };

    await admin
      .from('quests')
      .update({ status: 'completed', completed_at: now, verification_method: 'qr_scan' })
      .eq('id', quest.id);

    for (const uid of absent) await issueStrike(uid, 'no_show', `No-show for quest ${quest.id} (group ${groupId})`);

    // Members are released (chat stays readable only while left_at is null — see open question in handoff).
    await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).is('left_at', null);

    const attendees = members.filter((m) => checkedIn.has(m));
    after(async () => {
      await createNotifications(
        attendees.map((uid) => ({
          user_id: uid,
          type: 'review_reminder' as const,
          title_en: '🌟 How was your meetup?',
          title_ko: '🌟 만남은 어땠나요?',
          body_en: 'Leave quick tag reviews for your group and the venue (open for 14 days).',
          body_ko: '그룹 멤버와 장소에 간단한 태그 리뷰를 남겨 주세요 (14일간 가능).',
          action_url: `/matches/review/${quest.id}`,
          is_important: true,
        })),
      );
    });
    return { action: 'completed', check_in_count: checkedIn.size, strikes_issued: absent.length };
  }

  // Not enough check-ins: the meetup didn't happen. No strikes (see open question in handoff).
  const { data: won } = await admin
    .from('groups')
    .update({ phase: 'cancelled' })
    .eq('id', groupId)
    .eq('phase', 'scheduled')
    .select('id');
  if (!won || won.length === 0) return { action: 'skipped', reason: 'already closed' };
  await admin.from('quests').update({ status: 'cancelled', cancelled_at: now }).eq('id', quest.id);
  await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).is('left_at', null);
  return { action: 'failed', check_in_count: checkedIn.size, needed: MIN_CHECK_INS_TO_COMPLETE };
}

// ---------------------------------------------------------------------------
// Cron sweep: move every due group forward
// ---------------------------------------------------------------------------

export async function advanceDueGroups() {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const [{ data: availabilityDue }, { data: availabilityLegacy }, { data: votingDue }, { data: volunteerStuck }] = await Promise.all([
    admin
      .from('groups')
      .select('id')
      .eq('phase', 'availability')
      .eq('quest_type', 'venue')
      .eq('is_pending_invites', false)
      .lt('availability_phase_ends_at', now),
    // Groups activated before availability_phase_ends_at was being set.
    admin
      .from('groups')
      .select('id')
      .eq('phase', 'availability')
      .eq('quest_type', 'venue')
      .eq('is_pending_invites', false)
      .is('availability_phase_ends_at', null)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    admin.from('groups').select('id').eq('phase', 'voting').lt('voting_phase_ends_at', now),
    // Volunteer groups that were activated but never got their program vote (e.g. a transient failure).
    admin.from('groups').select('id').eq('phase', 'availability').eq('quest_type', 'volunteer').eq('is_pending_invites', false),
  ]);

  const results: Record<string, unknown>[] = [];
  for (const g of [...(availabilityDue ?? []), ...(availabilityLegacy ?? [])]) {
    results.push({ group_id: g.id, step: 'availability', ...(await computeCandidates(g.id as string)) });
  }
  for (const g of votingDue ?? []) {
    results.push({ group_id: g.id, step: 'voting', ...(await lockQuestDate(g.id as string)) });
  }
  for (const g of volunteerStuck ?? []) {
    results.push({ group_id: g.id, step: 'volunteer_voting', result: await startVolunteerVoting(g.id as string) });
  }
  const volunteerSignups = await closeVolunteerSignups();
  const closed = await closeExpiredQuests();
  const volunteerClosed = await closeExpiredVolunteerQuests();
  return { ok: true as const, advanced: results, volunteer_signups: volunteerSignups, closed, volunteer_closed: volunteerClosed };
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/** ~30–45 min before the meetup: "check-in opens soon" (the window opens 40 min before). */
export async function sendCheckInReminders() {
  const admin = getAdmin();
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: groups } = await admin
    .from('groups')
    .select('id, quest_scheduled_at, quest_type')
    .eq('phase', 'scheduled')
    .gte('quest_scheduled_at', from)
    .lt('quest_scheduled_at', to)
    .is('check_in_reminded_at', null);

  let reminded = 0;
  for (const g of groups ?? []) {
    const { data: won } = await admin
      .from('groups')
      .update({ check_in_reminded_at: new Date().toISOString() })
      .eq('id', g.id)
      .is('check_in_reminded_at', null)
      .select('id');
    if (!won || won.length === 0) continue;

    const members = await activeMemberIds(g.id as string);
    const volunteer = g.quest_type === 'volunteer';
    await createNotifications(
      members.map((uid) => ({
        user_id: uid,
        type: 'check_in_reminder' as const,
        title_en: volunteer ? '🤝 Volunteering starts soon' : '📍 Your meetup starts soon',
        title_ko: volunteer ? '🤝 곧 봉사활동이 시작돼요' : '📍 곧 만남이 시작돼요',
        body_en: volunteer
          ? `Starts ${formatKst(g.quest_scheduled_at as string, 'en')}. When you're together, take one group selfie in the app.`
          : `Starts ${formatKst(g.quest_scheduled_at as string, 'en')}. Check in with the venue QR when you arrive.`,
        body_ko: volunteer
          ? `${formatKst(g.quest_scheduled_at as string, 'ko')} 시작. 모이면 앱에서 단체 사진을 한 장 찍어 주세요.`
          : `${formatKst(g.quest_scheduled_at as string, 'ko')} 시작. 도착하면 매장 QR로 체크인하세요.`,
        action_url: volunteer ? `/matches/${g.id}/volunteer` : `/matches/${g.id}/check-in`,
        is_important: true,
      })),
    );
    reminded++;
  }
  return { ok: true as const, reminded };
}

/** Daily at 9am KST: notification + email for meetups in the next 24h. */
export async function sendQuestDayReminders() {
  const admin = getAdmin();
  const now = new Date();
  const { data: groups } = await admin
    .from('groups')
    .select('id, quest_scheduled_at')
    .eq('phase', 'scheduled')
    .gte('quest_scheduled_at', now.toISOString())
    .lt('quest_scheduled_at', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
    .is('quest_day_reminded_at', null);

  const results: Record<string, unknown>[] = [];
  for (const g of groups ?? []) {
    const { data: won } = await admin
      .from('groups')
      .update({ quest_day_reminded_at: new Date().toISOString() })
      .eq('id', g.id)
      .is('quest_day_reminded_at', null)
      .select('id');
    if (!won || won.length === 0) continue;

    const { data: quest } = await admin
      .from('quests')
      .select('quest_type, venue:venues(business_name_display), program:volunteer_programs(title, place)')
      .eq('group_id', g.id)
      .maybeSingle();
    const q = quest as {
      quest_type?: string;
      venue?: { business_name_display?: string } | null;
      program?: { title?: string; place?: string | null } | null;
    } | null;
    const venueName =
      q?.quest_type === 'volunteer'
        ? (q?.program?.place || q?.program?.title || '봉사 장소')
        : (q?.venue?.business_name_display ?? 'the venue');
    const members = await activeMemberIds(g.id as string);

    await createNotifications(
      members.map((uid) => ({
        user_id: uid,
        type: 'quest_day_reminder' as const,
        title_en: `🗓️ Your meetup at ${venueName} is coming up!`,
        title_ko: `🗓️ 곧 ${venueName}에서 만나요!`,
        body_en: q?.quest_type === 'volunteer'
          ? `${formatKst(g.quest_scheduled_at as string, 'en')} — volunteering at ${venueName}. Take one group selfie in the app when you're together.`
          : `${formatKst(g.quest_scheduled_at as string, 'en')} — scan the QR at ${venueName} to check in when you arrive.`,
        body_ko: q?.quest_type === 'volunteer'
          ? `${formatKst(g.quest_scheduled_at as string, 'ko')} — ${venueName}에서 봉사해요. 모이면 앱에서 단체 사진을 한 장 찍어 주세요.`
          : `${formatKst(g.quest_scheduled_at as string, 'ko')} — ${venueName}에 도착하면 QR 코드를 스캔해서 체크인하세요.`,
        action_url: '/matches',
        is_important: true,
      })),
    );
    await Promise.all(
      members.map((uid) =>
        sendQuestDayReminderEmail({ user_id: uid, venue_name: venueName, scheduled_at: g.quest_scheduled_at as string }).then(
          (r) => r.error && console.error('Quest-day email failed:', uid, r.error),
        ),
      ),
    );
    results.push({ group_id: g.id, members: members.length });
  }
  return { ok: true as const, processed: results.length, results };
}

/** Daily: nudge members who haven't submitted availability 12h+ after activation. */
export async function sendAvailabilityNudges() {
  const admin = getAdmin();
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: groups } = await admin
    .from('groups')
    .select('id')
    .eq('phase', 'availability')
    .eq('is_pending_invites', false)
    .lt('activated_at', cutoff);

  const results: Record<string, unknown>[] = [];
  for (const g of groups ?? []) {
    const { data: members } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at')
      .eq('group_id', g.id)
      .is('left_at', null)
      .is('availability_nudge_sent_at', null);
    const { data: subs } = await admin.from('availability_submissions').select('user_id').eq('group_id', g.id);
    const submitted = new Set((subs ?? []).map((s) => s.user_id as string));
    const need = (members ?? []).filter((m) => isAccepted(m) && !submitted.has(m.user_id as string)).map((m) => m.user_id as string);
    if (need.length === 0) continue;

    await createNotifications(
      need.map((uid) => ({
        user_id: uid,
        type: 'availability_reminder' as const,
        title_en: '⏰ Your group is waiting for you',
        title_ko: '⏰ 그룹이 기다리고 있어요',
        body_en: "Pick your available times — your group can't schedule without you!",
        body_ko: '가능한 시간을 선택해 주세요 — 여러분 없이는 일정을 잡을 수 없어요!',
        action_url: `/matches/${g.id}/availability`,
        is_important: true,
      })),
    );
    await admin
      .from('group_members')
      .update({ availability_nudge_sent_at: new Date().toISOString() })
      .eq('group_id', g.id)
      .in('user_id', need);
    results.push({ group_id: g.id, nudged: need.length });
  }
  return { ok: true as const, processed: results.length, results };
}
