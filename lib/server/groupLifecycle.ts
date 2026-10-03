import 'server-only';
import { after } from 'next/server';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotifications, type NotificationPayload } from '@/lib/notifications';
import { issueStrike } from '@/lib/server/strikes';
import { hoursFromNow } from '@/lib/server/time';
import { sendGroupActivatedEmail } from '@/lib/server/emails/group-activated';
import { sendGroupCancelledEmail } from '@/lib/server/emails/group-cancelled';

/**
 * Single source of truth for group state transitions.
 *
 *   pending invites ──(everyone answered, ≥2 accepted)──▶ availability ─▶ voting ─▶ scheduled ─▶ completed
 *          │                                                   │            │           │
 *          └──(everyone answered, <2 accepted)──▶ cancelled ◀──┴────────────┴───────────┘
 *
 * Every transition is written with a conditional UPDATE (…where is_pending_invites = true / phase = X)
 * so two concurrent callers (e.g. an accept and a decline arriving together) can't both win.
 */

export const MIN_GROUP_SIZE = 2;
export const ACTIVE_PHASES = ['availability', 'voting', 'scheduled'] as const;
export const AVAILABILITY_PHASE_HOURS = 24;

type Member = {
  user_id: string;
  invite_state: string | null;
  accepted_at: string | null;
  left_at: string | null;
};

export function isAccepted(m: Pick<Member, 'invite_state' | 'accepted_at'>) {
  return m.invite_state === 'accepted' || !!m.accepted_at;
}

async function loadGroupContext(groupId: string) {
  const admin = getAdmin();
  const [{ data: group }, { data: members }, { data: quest }] = await Promise.all([
    admin
      .from('groups')
      .select('id, phase, is_pending_invites, originated_by_request_id, quest_scheduled_at, created_by')
      .eq('id', groupId)
      .maybeSingle(),
    admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at, left_at')
      .eq('group_id', groupId),
    admin
      .from('quests')
      .select('id, status, venue:venues(business_name_display)')
      .eq('group_id', groupId)
      .maybeSingle(),
  ]);
  const venueName: string =
    ((quest as { venue?: { business_name_display?: string } | null } | null)?.venue?.business_name_display) ?? '';
  return { group, members: (members ?? []) as Member[], quest, venueName };
}

async function displayNames(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data } = await getAdmin().from('profiles').select('id, display_name').in('id', userIds);
  const out: Record<string, string> = {};
  for (const p of data ?? []) out[p.id as string] = (p.display_name as string) ?? '';
  return out;
}

async function markAllMembersLeft(groupId: string) {
  await getAdmin()
    .from('group_members')
    .update({ left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .is('left_at', null);
}

async function cancelQuest(groupId: string) {
  await getAdmin()
    .from('quests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .in('status', ['proposed', 'scheduled']);
}

// ---------------------------------------------------------------------------
// Pending-invite phase
// ---------------------------------------------------------------------------

/**
 * Call after any invite changes (accept / decline / expiry / accepted-member leaves while pending).
 * Activates the group, cancels it, or does nothing if people still need to answer.
 */
export async function evaluatePendingGroup(groupId: string): Promise<'not_pending' | 'waiting' | 'activated' | 'cancelled'> {
  const { group, members } = await loadGroupContext(groupId);
  if (!group?.is_pending_invites) return 'not_pending';

  const current = members.filter((m) => !m.left_at);
  const accepted = current.filter(isAccepted);
  const stillInvited = current.filter((m) => m.invite_state === 'invited');

  if (stillInvited.length > 0) return 'waiting';

  if (accepted.length >= MIN_GROUP_SIZE) {
    const won = await activateGroup(groupId);
    return won ? 'activated' : 'not_pending';
  }

  const won = await cancelPendingGroup(groupId);
  return won ? 'cancelled' : 'not_pending';
}

/** Pending → availability. Returns false if another request already transitioned it. */
export async function activateGroup(groupId: string): Promise<boolean> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data: won } = await admin
    .from('groups')
    .update({
      is_pending_invites: false,
      phase: 'availability',
      activated_at: now,
      availability_phase_ends_at: hoursFromNow(AVAILABILITY_PHASE_HOURS),
    })
    .eq('id', groupId)
    .eq('is_pending_invites', true)
    .select('id');
  if (!won || won.length === 0) return false;

  const { members, venueName } = await loadGroupContext(groupId);
  const { data: typeRow } = await admin.from('groups').select('quest_type').eq('id', groupId).maybeSingle();
  const isVolunteer = typeRow?.quest_type === 'volunteer';

  // Anyone who declined/expired but somehow has no left_at is released.
  const notAccepted = members.filter((m) => !m.left_at && !isAccepted(m)).map((m) => m.user_id);
  if (notAccepted.length > 0) {
    await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).in('user_id', notAccepted);
  }

  const acceptedIds = members.filter((m) => !m.left_at && isAccepted(m)).map((m) => m.user_id);

  // Invitees who also had their own open search are now matched — close those requests
  // so they don't get matched into a second group later.
  if (acceptedIds.length > 0) {
    await admin
      .from('match_requests')
      .update({ status: 'matched', matched_group_id: groupId, resolved_at: now })
      .in('user_id', acceptedIds)
      .eq('status', 'searching');
  }

  // Volunteer groups skip time-picking: they vote on 1365 programs (each has a fixed date).
  if (isVolunteer) {
    const { startVolunteerVoting } = await import('@/lib/server/volunteer');
    await startVolunteerVoting(groupId);
  }

  after(async () => {
    const names = await displayNames(acceptedIds);
    const notifs: NotificationPayload[] = acceptedIds.map((uid) =>
      isVolunteer
        ? {
            user_id: uid,
            type: 'match_activated',
            title_en: 'Your volunteer group is confirmed!',
            title_ko: '봉사 그룹이 확정되었어요!',
            body_en: "Everyone's in. Next, vote on which volunteer activity to do together.",
            body_ko: '모두 참여했어요. 이제 함께할 봉사활동을 투표로 골라 주세요.',
            action_url: `/matches/${groupId}/volunteer`,
            is_important: true,
          }
        : {
            user_id: uid,
            type: 'match_activated',
            title_en: 'Your group is confirmed!',
            title_ko: '그룹이 확정되었어요!',
            body_en: `Everyone's in${venueName ? ` for ${venueName}` : ''}. Pick the times you're free within 24 hours.`,
            body_ko: `모두 참여했어요${venueName ? ` (${venueName})` : ''}. 24시간 안에 가능한 시간을 선택해 주세요.`,
            action_url: `/matches/${groupId}/availability`,
            is_important: true,
          },
    );
    await createNotifications(notifs);
    await Promise.all(
      acceptedIds.map((uid) =>
        sendGroupActivatedEmail({
          user_id: uid,
          group_id: groupId,
          venue_name: isVolunteer ? '봉사활동 · Volunteering' : venueName,
          other_member_names: acceptedIds.filter((x) => x !== uid).map((x) => names[x]).filter(Boolean),
        }).then((r) => r.error && console.error('Activation email failed:', uid, r.error)),
      ),
    );
  });

  return true;
}

/**
 * Pending → cancelled because not enough people accepted.
 * Reopens the requester's search (with a fresh pass clock) and retries immediately.
 */
export async function cancelPendingGroup(groupId: string): Promise<boolean> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data: won } = await admin
    .from('groups')
    .update({ is_pending_invites: false, phase: 'cancelled' })
    .eq('id', groupId)
    .eq('is_pending_invites', true)
    .select('id, originated_by_request_id');
  if (!won || won.length === 0) return false;

  const { members } = await loadGroupContext(groupId);
  await markAllMembersLeft(groupId);
  await cancelQuest(groupId);

  const requestId = won[0].originated_by_request_id as string | null;
  let requesterId: string | null = null;

  if (requestId) {
    const { data: req } = await admin
      .from('match_requests')
      .select('id, user_id, status, excluded_user_ids')
      .eq('id', requestId)
      .maybeSingle();

    if (req) {
      requesterId = req.user_id as string;
      // Only reopen if the requester didn't cancel the request themselves.
      if (req.status === 'matched') {
        const excluded = new Set<string>((req.excluded_user_ids as string[] | null) ?? []);
        for (const m of members) if (m.user_id !== requesterId) excluded.add(m.user_id);
        await admin
          .from('match_requests')
          .update({
            status: 'searching',
            matched_group_id: null,
            resolved_at: null,
            excluded_user_ids: Array.from(excluded),
            search_started_at: now,
          })
          .eq('id', requestId);
      }
    }
  }

  // Accepted invitees (not the requester) are told the group didn't fill.
  const otherAccepted = members.filter((m) => isAccepted(m) && m.user_id !== requesterId).map((m) => m.user_id);

  after(async () => {
    const notifs: NotificationPayload[] = [];
    if (requesterId) {
      notifs.push({
        user_id: requesterId,
        type: 'match_cancelled',
        title_en: "Not enough people accepted — we're finding you a new group",
        title_ko: '수락한 사람이 부족했어요 — 새 그룹을 찾고 있어요',
        body_en: "No action needed. We'll let you know as soon as we find a new match.",
        body_ko: '따로 하실 일은 없어요. 새 매칭을 찾으면 바로 알려드릴게요.',
        action_url: '/matches',
        is_important: true,
      });
    }
    for (const uid of otherAccepted) {
      notifs.push({
        user_id: uid,
        type: 'match_cancelled',
        title_en: "This group didn't fill up",
        title_ko: '이번 그룹은 인원이 채워지지 않았어요',
        body_en: 'Not enough people accepted, so it was closed. No strike for you — request a new match any time.',
        body_ko: '수락 인원이 부족해 그룹이 종료되었어요. 경고는 없어요 — 언제든 새 매칭을 요청하세요.',
        action_url: '/matches',
      });
    }
    await createNotifications(notifs);
    if (requesterId) {
      const r = await sendGroupCancelledEmail({
        user_id: requesterId,
        reason: 'Not enough people accepted the invite',
        will_retry: true,
      });
      if (r.error) console.error('Cancellation email failed:', r.error);
    }
    if (requestId) {
      const { processMatchRequests } = await import('@/lib/server/matching');
      await processMatchRequests({ requestId });
    }
  });

  return true;
}

/** Requester withdraws while invites are still pending: close the group for everyone, no strike. */
export async function withdrawPendingGroup(groupId: string, requesterId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data: won } = await admin
    .from('groups')
    .update({ is_pending_invites: false, phase: 'cancelled' })
    .eq('id', groupId)
    .eq('is_pending_invites', true)
    .select('id');
  if (!won || won.length === 0) return false;

  const { members } = await loadGroupContext(groupId);
  await markAllMembersLeft(groupId);
  await cancelQuest(groupId);

  const others = members
    .filter((m) => m.user_id !== requesterId && !m.left_at && (m.invite_state === 'invited' || isAccepted(m)))
    .map((m) => m.user_id);

  after(async () => {
    await createNotifications(
      others.map((uid) => ({
        user_id: uid,
        type: 'match_cancelled' as const,
        title_en: 'A match invite was withdrawn',
        title_ko: '매칭 초대가 취소되었어요',
        body_en: 'The group was closed before it started. Nothing you need to do.',
        body_ko: '그룹이 시작되기 전에 종료되었어요. 따로 하실 일은 없어요.',
        action_url: '/matches',
      })),
    );
  });

  return true;
}

// ---------------------------------------------------------------------------
// Active groups (availability / voting / scheduled)
// ---------------------------------------------------------------------------

/**
 * Close an active group (e.g. no common time slot, or members left).
 * Remaining members get a no-strike notification.
 */
export async function cancelActiveGroup(
  groupId: string,
  reason: { en: string; ko: string },
  opts: { struckUserIds?: string[] } = {},
): Promise<boolean> {
  const admin = getAdmin();
  const { members } = await loadGroupContext(groupId);

  const { data: won } = await admin
    .from('groups')
    .update({ phase: 'cancelled', is_pending_invites: false })
    .eq('id', groupId)
    .in('phase', [...ACTIVE_PHASES])
    .select('id');
  if (!won || won.length === 0) return false;

  const remaining = members.filter((m) => !m.left_at && isAccepted(m)).map((m) => m.user_id);
  await markAllMembersLeft(groupId);
  await cancelQuest(groupId);

  const struck = new Set(opts.struckUserIds ?? []);
  after(async () => {
    await createNotifications(
      remaining.map((uid) => ({
        user_id: uid,
        type: 'match_cancelled' as const,
        title_en: 'Your group was closed',
        title_ko: '그룹이 종료되었어요',
        // Members who get a no-show strike hear about it from the strike notification itself.
        body_en: struck.has(uid) ? reason.en : `${reason.en} No strike for you — request a new match any time.`,
        body_ko: struck.has(uid) ? reason.ko : `${reason.ko} 경고는 없어요 — 언제든 새 매칭을 요청하세요.`,
        action_url: '/matches',
        is_important: true,
      })),
    );
  });

  return true;
}

export type LeaveResult =
  | { ok: true; strike_issued: boolean; strike_number?: number; freeze_until?: string | null; group_continues: boolean }
  | { ok: false; error: string; status: number };

/**
 * A member leaves a group.
 *  - Pending group, requester  → withdraw the whole group (no strike)
 *  - Pending group, accepted invitee → leave, re-evaluate (no strike: the group never started)
 *  - Active group (availability/voting/scheduled) → leave + strike; group continues if ≥2 remain
 */
export async function leaveGroup(userId: string, groupId: string): Promise<LeaveResult> {
  const admin = getAdmin();
  const { group, members, venueName } = await loadGroupContext(groupId);
  if (!group) return { ok: false, error: 'group_not_found', status: 404 };

  const me = members.find((m) => m.user_id === userId);
  if (!me || me.left_at) return { ok: false, error: 'not_a_member', status: 403 };
  if (me.invite_state === 'invited') return { ok: false, error: 'use_decline_instead', status: 400 };
  if (!isAccepted(me)) return { ok: false, error: 'not_a_member', status: 403 };

  const now = new Date().toISOString();

  // ---- still collecting invites
  if (group.is_pending_invites) {
    if (group.created_by === userId) {
      await withdrawPendingGroup(groupId, userId);
      if (group.originated_by_request_id) {
        await admin
          .from('match_requests')
          .update({ status: 'cancelled_by_user', resolved_at: now })
          .eq('id', group.originated_by_request_id);
      }
      return { ok: true, strike_issued: false, group_continues: false };
    }
    await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).eq('user_id', userId);
    const state = await evaluatePendingGroup(groupId);
    return { ok: true, strike_issued: false, group_continues: state !== 'cancelled' };
  }

  // ---- active group
  if (!ACTIVE_PHASES.includes(group.phase as (typeof ACTIVE_PHASES)[number])) {
    return { ok: false, error: 'group_not_active', status: 400 };
  }
  if (group.phase === 'scheduled' && group.quest_scheduled_at && Date.now() >= new Date(group.quest_scheduled_at).getTime()) {
    // After the meetup has started, leaving is a no-show — the close-out cron handles it.
    return { ok: false, error: 'meetup_already_started', status: 400 };
  }

  await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).eq('user_id', userId);
  // Their availability and vote no longer count.
  await Promise.all([
    admin.from('availability_submissions').delete().eq('group_id', groupId).eq('user_id', userId),
    admin.from('date_votes').delete().eq('group_id', groupId).eq('user_id', userId),
  ]);

  const strike = await issueStrike(userId, 'cancelled_match', `Left group ${groupId} during ${group.phase} phase`);

  const remaining = members.filter((m) => m.user_id !== userId && !m.left_at && isAccepted(m)).map((m) => m.user_id);

  if (remaining.length >= MIN_GROUP_SIZE) {
    after(async () => {
      const names = await displayNames([userId]);
      const who = names[userId] || 'A member';
      const whoKo = names[userId] || '멤버 한 명';
      await createNotifications(
        remaining.map((uid) => ({
          user_id: uid,
          type: 'member_left' as const,
          title_en: `${who} left the group`,
          title_ko: `${whoKo}님이 그룹을 나갔어요`,
          body_en: `Your meetup${venueName ? ` at ${venueName}` : ''} is still on with the rest of the group.`,
          body_ko: `${venueName ? `${venueName}에서의 ` : ''}만남은 남은 멤버들과 그대로 진행돼요.`,
          action_url: '/matches',
        })),
      );
    });
    return {
      ok: true,
      strike_issued: strike.ok,
      strike_number: strike.ok ? strike.strike_number : undefined,
      freeze_until: strike.ok ? strike.freeze_until : undefined,
      group_continues: true,
    };
  }

  await cancelActiveGroup(groupId, {
    en: 'Other members left, so there are not enough people for the meetup.',
    ko: '다른 멤버들이 나가서 만남을 진행할 인원이 부족해요.',
  });
  return {
    ok: true,
    strike_issued: strike.ok,
    strike_number: strike.ok ? strike.strike_number : undefined,
    freeze_until: strike.ok ? strike.freeze_until : undefined,
    group_continues: false,
  };
}

// ---------------------------------------------------------------------------
// Invite expiry (run from the matching cron)
// ---------------------------------------------------------------------------

export async function expireOverdueInvites(): Promise<{ expired: number; groups_evaluated: number }> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data: overdue } = await admin
    .from('group_members')
    .select('group_id, user_id')
    .eq('invite_state', 'invited')
    .is('left_at', null)
    .lt('invite_expires_at', now);

  if (!overdue || overdue.length === 0) return { expired: 0, groups_evaluated: 0 };

  for (const inv of overdue) {
    await admin
      .from('group_members')
      .update({ invite_state: 'expired', declined_at: now, left_at: now })
      .eq('group_id', inv.group_id)
      .eq('user_id', inv.user_id)
      .eq('invite_state', 'invited');
  }

  const groupIds = [...new Set(overdue.map((o) => String(o.group_id)))];
  for (const gid of groupIds) await evaluatePendingGroup(gid);
  return { expired: overdue.length, groups_evaluated: groupIds.length };
}
