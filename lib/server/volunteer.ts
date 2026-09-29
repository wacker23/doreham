import 'server-only';
import { after } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotifications, type NotificationPayload } from '@/lib/notifications';
import { cancelActiveGroup, isAccepted, MIN_GROUP_SIZE } from '@/lib/server/groupLifecycle';
import { formatKst, hoursFromNow, kstDateString } from '@/lib/server/time';
import { ensureProgramTranslations } from '@/lib/server/translatePrograms';

/**
 * Volunteer quests (봉사활동 퀘스트).
 *
 *   pending invites → (activated) → voting on 1365 programs → scheduled
 *     → 24h signup window: each member signs up on 1365 and taps "I'm registered"
 *       (can't get a spot / didn't confirm → removed, no strike; group continues if ≥2)
 *     → activity day: ONE group selfie (required) tagging who is there → completed
 *       (1365 certificates are optional extras)
 *     → no selfie by 18h after start → closed, no strikes
 */

export const VOLUNTEER_VOTING_HOURS = 24;
export const SIGNUP_WINDOW_HOURS = 24;
export const SELFIE_OPENS_BEFORE_MIN = 60;
export const SELFIE_CLOSES_AFTER_HOURS = 18;
export const CERTIFICATE_DAYS = 14;
const MAX_OPTIONS = 3;
const EARLIEST_DAYS_AHEAD = 2; // leave time to sign up on 1365
const LATEST_DAYS_AHEAD = 14;
const DEFAULT_START_HOUR = 10;

export const PROOF_BUCKET = 'volunteer-proofs';

type ProgramRow = {
  id: string;
  title: string;
  status: number | null;
  program_start: string | null;
  program_end: string | null;
  act_begin_hour: number | null;
  act_end_hour: number | null;
  notice_end: string | null;
  recruit_count: number | null;
  applied_count: number | null;
  act_weekdays: string | null;
  adult_ok: boolean | null;
  org_name: string | null;
  place: string | null;
  detail_url: string | null;
};

// ---------------------------------------------------------------------------
// Program options for a group
// ---------------------------------------------------------------------------

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Mon … 6 = Sun */
function weekdayIndex(ymd: string): number {
  return (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Which weekdays (0 = Mon … 6 = Sun) a program runs, from 1365's actWkdy.
 * Accepts a 7-char 0/1 mask starting Monday (1365 lists 월→일) or Korean day letters ("월,수,금").
 * Returns null when the format is unknown.
 */
function activeWeekdays(actWkdy: string | null): Set<number> | null {
  if (!actWkdy) return null;
  const v = actWkdy.trim();
  if (/^[01]{7}$/.test(v)) return new Set([...v].flatMap((c, i) => (c === '1' ? [i] : [])));
  const letters = '월화수목금토일';
  const days = [...v].map((c) => letters.indexOf(c)).filter((i) => i >= 0);
  return days.length ? new Set(days) : null;
}

/** KST wall-clock → UTC ISO. */
function kstToIso(ymd: string, hour: number): string {
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00+09:00`).toISOString();
}

export async function buildVolunteerOptions(city: string, groupSize: number) {
  const today = kstDateString();
  const from = addDays(today, EARLIEST_DAYS_AHEAD);
  const to = addDays(today, LATEST_DAYS_AHEAD);

  const { data } = await getAdmin()
    .from('volunteer_programs')
    .select('id, title, status, program_start, program_end, act_begin_hour, act_end_hour, notice_end, recruit_count, applied_count, act_weekdays, adult_ok, org_name, place, detail_url')
    .eq('city', city)
    .gte('program_end', from)
    .lte('program_start', to);

  const options: { program: ProgramRow; date: string; slot_time: string; weekend: boolean }[] = [];
  for (const p of (data ?? []) as ProgramRow[]) {
    if (p.adult_ok === false) continue;
    if (p.status === 3) continue; // 모집완료
    if (p.notice_end && p.notice_end < addDays(today, 1)) continue; // recruiting must stay open while members sign up
    if (p.recruit_count != null && p.applied_count != null && p.recruit_count - p.applied_count < groupSize) continue;

    const start = p.program_start && p.program_start > from ? p.program_start : from;
    let end = p.program_end && p.program_end < to ? p.program_end : to;
    if (p.notice_end && p.notice_end < end) end = p.notice_end;

    // A one-day program runs on its date. A longer one (e.g. a month of weekday afternoons) is only
    // offered once the detail sync has told us which weekdays it runs, so we never send a group on a closed day.
    const weekdays = activeWeekdays(p.act_weekdays);
    const oneDay = !!p.program_start && p.program_start === p.program_end;
    if (!oneDay && !weekdays) continue;

    let firstDay: string | null = null;
    let firstWeekend: string | null = null;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (weekdays && !weekdays.has(weekdayIndex(d))) continue;
      firstDay ??= d;
      if (weekdayIndex(d) >= 5) {
        firstWeekend = d;
        break;
      }
    }
    const date = firstWeekend ?? firstDay;
    if (!date) continue;
    options.push({
      program: p,
      date,
      slot_time: kstToIso(date, p.act_begin_hour ?? DEFAULT_START_HOUR),
      weekend: weekdayIndex(date) >= 5,
    });
  }

  // Weekends first (easier for a new group), then soonest.
  options.sort((a, b) => Number(b.weekend) - Number(a.weekend) || a.slot_time.localeCompare(b.slot_time));
  return options.slice(0, MAX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Activation → voting
// ---------------------------------------------------------------------------

async function acceptedMemberIds(groupId: string): Promise<string[]> {
  const { data } = await getAdmin()
    .from('group_members')
    .select('user_id, invite_state, accepted_at, left_at')
    .eq('group_id', groupId)
    .is('left_at', null);
  return (data ?? []).filter(isAccepted).map((m) => m.user_id as string);
}

export async function startVolunteerVoting(groupId: string): Promise<'voting' | 'cancelled' | 'skipped'> {
  const admin = getAdmin();
  const { data: group } = await admin
    .from('groups')
    .select('id, city, phase, is_pending_invites, quest_type')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || group.quest_type !== 'volunteer' || group.is_pending_invites || group.phase !== 'availability') return 'skipped';

  const members = await acceptedMemberIds(groupId);
  const options = await buildVolunteerOptions(String(group.city), Math.max(members.length, MIN_GROUP_SIZE));

  if (options.length === 0) {
    await cancelActiveGroup(groupId, {
      en: "There are no volunteer activities with enough open spots in your city in the next two weeks.",
      ko: '앞으로 2주 안에 우리 그룹이 함께 참여할 수 있는 봉사활동이 없어요.',
    });
    return 'cancelled';
  }

  const votingEnd = hoursFromNow(VOLUNTEER_VOTING_HOURS);
  const { data: won } = await admin
    .from('groups')
    .update({ phase: 'voting', voting_phase_ends_at: votingEnd })
    .eq('id', groupId)
    .eq('phase', 'availability')
    .select('id');
  if (!won || won.length === 0) return 'skipped';

  await admin.from('candidate_slots').delete().eq('group_id', groupId);
  const { error } = await admin.from('candidate_slots').insert(
    options.map((o) => ({
      group_id: groupId,
      slot_time: o.slot_time,
      volunteer_program_id: o.program.id,
      available_user_ids: members,
    })),
  );
  if (error) {
    await admin.from('groups').update({ phase: 'availability' }).eq('id', groupId);
    console.error('startVolunteerVoting insert failed:', error);
    return 'skipped';
  }

  // English versions of the options (1365 is Korean-only). Bounded so activation never hangs;
  // anything missed is picked up by the advance-groups cron sweep.
  try {
    await ensureProgramTranslations(options.map((o) => o.program.id), { timeoutMs: 8000 });
  } catch (e) {
    console.error('Volunteer option translation failed:', e);
  }

  after(async () => {
    await createNotifications(
      members.map((uid) => ({
        user_id: uid,
        type: 'availability_reminder' as const,
        title_en: '🤝 Vote on where to volunteer',
        title_ko: '🤝 어디서 봉사할지 투표해 주세요',
        body_en: `We found ${options.length} volunteer ${options.length === 1 ? 'activity' : 'activities'} for your group. Vote within 24 hours.`,
        body_ko: `그룹이 함께할 수 있는 봉사활동 ${options.length}개를 찾았어요. 24시간 안에 투표해 주세요.`,
        action_url: `/matches/${groupId}/volunteer`,
        is_important: true,
      })),
    );
  });
  return 'voting';
}

// ---------------------------------------------------------------------------
// Vote locked → signup window
// ---------------------------------------------------------------------------

export async function onVolunteerSlotLocked(groupId: string, slot: { id: string; slot_time: string }) {
  const admin = getAdmin();
  const { data: cand } = await admin.from('candidate_slots').select('volunteer_program_id').eq('id', slot.id).maybeSingle();
  const programId = cand?.volunteer_program_id as string | null;
  if (!programId) return;

  const { data: program } = await admin
    .from('volunteer_programs')
    .select('id, title, title_en, place, place_en, org_name, org_name_en, detail_url')
    .eq('id', programId)
    .maybeSingle();
  const titleEn = program?.title_en || program?.title || '';

  const deadlineMs = Math.min(Date.now() + SIGNUP_WINDOW_HOURS * 3600_000, new Date(slot.slot_time).getTime() - 12 * 3600_000);
  const deadline = new Date(Math.max(deadlineMs, Date.now() + 2 * 3600_000)).toISOString();

  await Promise.all([
    admin
      .from('quests')
      .update({
        volunteer_program_id: programId,
        title: `🤝 ${program?.title ?? '봉사활동'}`,
        title_en: `🤝 Volunteer: ${titleEn}`.trim(),
        quest_description: [program?.org_name, program?.place].filter(Boolean).join(' · ') || null,
        description_en:
          [program?.org_name_en || program?.org_name, program?.place_en || program?.place].filter(Boolean).join(' · ') || null,
      })
      .eq('group_id', groupId),
    admin.from('groups').update({ volunteer_signup_deadline: deadline }).eq('id', groupId),
  ]);

  const members = await acceptedMemberIds(groupId);
  after(async () => {
    await createNotifications(
      members.map((uid) => ({
        user_id: uid,
        type: 'quest_scheduled' as const,
        title_en: `📝 Sign up on 1365: ${formatKst(slot.slot_time, 'en')}`,
        title_ko: `📝 1365에서 신청하세요: ${formatKst(slot.slot_time, 'ko')}`,
        body_en: `Your group chose "${titleEn || 'a volunteer activity'}". Sign up on 1365, then tap "I'm registered" by ${formatKst(deadline, 'en')}.`,
        body_ko: `그룹이 "${program?.title ?? '봉사활동'}"을(를) 선택했어요. 1365에서 신청한 뒤 ${formatKst(deadline, 'ko')}까지 "신청 완료"를 눌러 주세요.`,
        action_url: `/matches/${groupId}/volunteer`,
        is_important: true,
      })),
    );
  });
}

// ---------------------------------------------------------------------------
// Signup confirmation
// ---------------------------------------------------------------------------

export type SignupResult = { ok: true; group_continues: boolean } | { ok: false; error: string; status: number };

export async function recordVolunteerSignup(userId: string, groupId: string, action: 'registered' | 'no_spot'): Promise<SignupResult> {
  const admin = getAdmin();
  const { data: group } = await admin
    .from('groups')
    .select('id, phase, quest_type, volunteer_signup_deadline, volunteer_signup_closed_at')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || group.quest_type !== 'volunteer') return { ok: false, error: 'not_a_volunteer_group', status: 404 };
  if (group.phase !== 'scheduled') return { ok: false, error: 'signup_not_open', status: 400 };
  if (group.volunteer_signup_closed_at) return { ok: false, error: 'signup_closed', status: 400 };

  const { data: me } = await admin
    .from('group_members')
    .select('user_id, invite_state, accepted_at, left_at, volunteer_signup_confirmed_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!me || me.left_at || !isAccepted(me)) return { ok: false, error: 'not_a_member', status: 403 };

  const now = new Date().toISOString();
  if (action === 'registered') {
    await admin
      .from('group_members')
      .update({ volunteer_signup_confirmed_at: now })
      .eq('group_id', groupId)
      .eq('user_id', userId);
    return { ok: true, group_continues: true };
  }

  // Couldn't get a spot: leave without a strike.
  await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).eq('user_id', userId);
  const remaining = await acceptedMemberIds(groupId);
  if (remaining.length < MIN_GROUP_SIZE) {
    await cancelActiveGroup(groupId, {
      en: "Not enough members could get a spot on 1365 for this activity.",
      ko: '1365에서 이 활동에 신청할 수 있었던 멤버가 부족했어요.',
    });
    return { ok: true, group_continues: false };
  }
  after(async () => {
    const { data: prof } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    const name = (prof?.display_name as string) || '';
    await createNotifications(
      remaining.map((uid) => ({
        user_id: uid,
        type: 'member_left' as const,
        title_en: `${name || 'A member'} couldn't get a 1365 spot`,
        title_ko: `${name ? `${name}님이` : '멤버 한 명이'} 1365 신청을 못 했어요`,
        body_en: 'The volunteer quest is still on with the rest of the group.',
        body_ko: '남은 멤버들과 봉사 퀘스트는 그대로 진행돼요.',
        action_url: `/matches/${groupId}/volunteer`,
      })),
    );
  });
  return { ok: true, group_continues: true };
}

/** Cron: close signup windows. Unconfirmed members are released (no strike). */
export async function closeVolunteerSignups() {
  const admin = getAdmin();
  const { data: groups } = await admin
    .from('groups')
    .select('id')
    .eq('quest_type', 'volunteer')
    .eq('phase', 'scheduled')
    .is('volunteer_signup_closed_at', null)
    .lt('volunteer_signup_deadline', new Date().toISOString());

  const results: Record<string, unknown>[] = [];
  for (const g of groups ?? []) {
    const { data: won } = await admin
      .from('groups')
      .update({ volunteer_signup_closed_at: new Date().toISOString() })
      .eq('id', g.id)
      .is('volunteer_signup_closed_at', null)
      .select('id');
    if (!won || won.length === 0) continue;

    const { data: members } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at, volunteer_signup_confirmed_at')
      .eq('group_id', g.id)
      .is('left_at', null);
    const active = (members ?? []).filter(isAccepted);
    const unconfirmed = active.filter((m) => !m.volunteer_signup_confirmed_at).map((m) => m.user_id as string);
    const confirmed = active.filter((m) => m.volunteer_signup_confirmed_at).map((m) => m.user_id as string);

    if (unconfirmed.length > 0) {
      await admin.from('group_members').update({ left_at: new Date().toISOString() }).eq('group_id', g.id).in('user_id', unconfirmed);
    }

    if (confirmed.length < MIN_GROUP_SIZE) {
      await cancelActiveGroup(g.id as string, {
        en: 'Fewer than two members confirmed their 1365 signup in time.',
        ko: '1365 신청을 제때 확인한 멤버가 두 명 미만이었어요.',
      });
      results.push({ group_id: g.id, action: 'cancelled', confirmed: confirmed.length });
    } else {
      results.push({ group_id: g.id, action: 'confirmed', confirmed: confirmed.length, released: unconfirmed.length });
    }

    const notifs: NotificationPayload[] = unconfirmed.map((uid) => ({
      user_id: uid,
      type: 'match_cancelled',
      title_en: 'You were removed from a volunteer group',
      title_ko: '봉사 그룹에서 제외되었어요',
      body_en: "You didn't confirm your 1365 signup in time. No strike — join another quest any time.",
      body_ko: '1365 신청 확인이 제때 되지 않았어요. 경고는 없어요 — 언제든 다른 퀘스트에 참여하세요.',
      action_url: '/matches',
    }));
    if (confirmed.length >= MIN_GROUP_SIZE) {
      for (const uid of confirmed) {
        notifs.push({
          user_id: uid,
          type: 'quest_scheduled',
          title_en: `✅ ${confirmed.length} of you are signed up`,
          title_ko: `✅ ${confirmed.length}명이 신청을 마쳤어요`,
          body_en: "On the day, take one group selfie at the place — that's all we need.",
          body_ko: '당일 봉사 장소에서 단체 사진 한 장만 찍어 주세요 — 그걸로 충분해요.',
          action_url: `/matches/${g.id}/volunteer`,
        });
      }
    }
    await createNotifications(notifs);
  }
  return { ok: true as const, processed: results.length, results };
}

// ---------------------------------------------------------------------------
// Proof upload (selfie required, certificate optional)
// ---------------------------------------------------------------------------

/** In the group at the end: never left, or released by the completion itself (left_at = completed_at). */
function inAtEnd(m: { left_at: string | null }, completedAt: string | null): boolean {
  if (!m.left_at) return true;
  return !!completedAt && Date.parse(m.left_at) >= Date.parse(completedAt);
}

export type ProofKind = 'group_selfie' | 'certificate';
export type ProofResult =
  | { ok: true; proof_id: string; completed: boolean }
  | { ok: false; error: string; status: number };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function recordVolunteerProof(opts: {
  userId: string;
  groupId: string;
  kind: ProofKind;
  file: File;
  taggedUserIds: string[];
  latitude?: number | null;
  longitude?: number | null;
}): Promise<ProofResult> {
  const admin = getAdmin();
  const { data: group } = await admin
    .from('groups')
    .select('id, phase, quest_type, quest_scheduled_at, completed_at')
    .eq('id', opts.groupId)
    .maybeSingle();
  if (!group || group.quest_type !== 'volunteer') return { ok: false, error: 'not_a_volunteer_group', status: 404 };
  if (!['scheduled', 'completed'].includes(group.phase as string) || !group.quest_scheduled_at) {
    return { ok: false, error: 'not_scheduled', status: 400 };
  }

  const { data: members } = await admin
    .from('group_members')
    .select('user_id, invite_state, accepted_at, left_at, volunteer_signup_confirmed_at')
    .eq('group_id', opts.groupId);
  const me = (members ?? []).find((m) => m.user_id === opts.userId);
  const completedAt = (group.completed_at as string | null) ?? null;
  const stillIn = me && isAccepted(me) && inAtEnd(me, completedAt);
  if (!stillIn) return { ok: false, error: 'not_a_member', status: 403 };

  const start = new Date(group.quest_scheduled_at as string).getTime();
  const now = Date.now();
  if (opts.kind === 'group_selfie') {
    if (now < start - SELFIE_OPENS_BEFORE_MIN * 60_000) return { ok: false, error: 'too_early', status: 400 };
    if (now > start + SELFIE_CLOSES_AFTER_HOURS * 3600_000) return { ok: false, error: 'too_late', status: 400 };
    if (!IMAGE_TYPES.includes(opts.file.type)) return { ok: false, error: 'photo_required', status: 400 };
  } else {
    if (now < start - SELFIE_OPENS_BEFORE_MIN * 60_000) return { ok: false, error: 'too_early', status: 400 };
    if (now > start + CERTIFICATE_DAYS * 24 * 3600_000) return { ok: false, error: 'too_late', status: 400 };
    if (![...IMAGE_TYPES, 'application/pdf'].includes(opts.file.type)) return { ok: false, error: 'unsupported_file', status: 400 };
  }
  if (opts.file.size > 10 * 1024 * 1024) return { ok: false, error: 'file_too_large', status: 400 };

  // Only people who are (or were, at completion) in the group can be tagged; the uploader is always in.
  const eligible = new Set(
    (members ?? [])
      .filter((m) => isAccepted(m) && inAtEnd(m, completedAt))
      .map((m) => m.user_id as string),
  );
  const tagged = opts.kind === 'group_selfie'
    ? [...new Set([opts.userId, ...opts.taggedUserIds.filter((id) => eligible.has(id))])]
    : [opts.userId];

  const ext = opts.file.type === 'application/pdf' ? 'pdf' : (opts.file.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const path = `${opts.groupId}/${opts.kind}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await opts.file.arrayBuffer());
  const { error: upErr } = await admin.storage.from(PROOF_BUCKET).upload(path, bytes, {
    contentType: opts.file.type,
    upsert: false,
  });
  if (upErr) return { ok: false, error: `upload_failed: ${upErr.message}`, status: 500 };

  const { data: quest } = await admin.from('quests').select('id').eq('group_id', opts.groupId).maybeSingle();
  const { data: proof, error: insErr } = await admin
    .from('volunteer_proofs')
    .insert({
      group_id: opts.groupId,
      quest_id: quest?.id,
      user_id: opts.userId,
      kind: opts.kind,
      storage_path: path,
      tagged_user_ids: tagged,
      latitude: Number.isFinite(opts.latitude as number) ? opts.latitude : null,
      longitude: Number.isFinite(opts.longitude as number) ? opts.longitude : null,
    })
    .select('id')
    .single();
  if (insErr || !proof) return { ok: false, error: `save_failed: ${insErr?.message}`, status: 500 };

  let completed = false;
  if (opts.kind === 'group_selfie' && group.phase === 'scheduled' && tagged.length >= MIN_GROUP_SIZE) {
    completed = await completeVolunteerQuest(opts.groupId, tagged);
  }
  return { ok: true, proof_id: proof.id as string, completed };
}

async function completeVolunteerQuest(groupId: string, attendees: string[]): Promise<boolean> {
  const admin = getAdmin();
  const now = new Date().toISOString();
  const { data: won } = await admin
    .from('groups')
    .update({ phase: 'completed', completed_at: now })
    .eq('id', groupId)
    .eq('phase', 'scheduled')
    .select('id');
  if (!won || won.length === 0) return false;

  const { data: quest } = await admin
    .from('quests')
    .update({ status: 'completed', completed_at: now, verification_method: 'group_selfie' })
    .eq('group_id', groupId)
    .select('id')
    .maybeSingle();
  await admin.from('group_members').update({ left_at: now }).eq('group_id', groupId).is('left_at', null);

  after(async () => {
    await createNotifications(
      attendees.map((uid) => ({
        user_id: uid,
        type: 'review_reminder' as const,
        title_en: '🌟 Thank you for volunteering together!',
        title_ko: '🌟 함께 봉사해 주셔서 고마워요!',
        body_en: 'Leave quick tag reviews for your group (open for 14 days). Adding your 1365 certificate is optional.',
        body_ko: '그룹 멤버에게 간단한 태그 리뷰를 남겨 주세요 (14일간 가능). 1365 확인서 등록은 선택이에요.',
        action_url: quest?.id ? `/matches/review/${quest.id}` : '/matches',
        is_important: true,
      })),
    );
  });
  return true;
}

/** Cron: no group selfie by 18h after start → close without strikes. */
export async function closeExpiredVolunteerQuests() {
  const admin = getAdmin();
  const cutoff = new Date(Date.now() - SELFIE_CLOSES_AFTER_HOURS * 3600_000).toISOString();
  const { data: groups } = await admin
    .from('groups')
    .select('id')
    .eq('quest_type', 'volunteer')
    .eq('phase', 'scheduled')
    .lt('quest_scheduled_at', cutoff);

  let closed = 0;
  for (const g of groups ?? []) {
    const ok = await cancelActiveGroup(g.id as string, {
      en: 'No group selfie was uploaded, so this volunteer quest could not be completed.',
      ko: '단체 사진이 올라오지 않아 이번 봉사 퀘스트를 완료하지 못했어요.',
    });
    if (ok) closed++;
  }
  return { ok: true as const, closed };
}

/** Hourly: remind members who haven't confirmed their 1365 signup (once, within 8h of the deadline). */
export async function sendVolunteerSignupNudges() {
  const admin = getAdmin();
  const soon = new Date(Date.now() + 8 * 3600_000).toISOString();
  const { data: groups } = await admin
    .from('groups')
    .select('id, volunteer_signup_deadline')
    .eq('quest_type', 'volunteer')
    .eq('phase', 'scheduled')
    .is('volunteer_signup_closed_at', null)
    .lt('volunteer_signup_deadline', soon);

  let nudged = 0;
  for (const g of groups ?? []) {
    const { data: members } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at')
      .eq('group_id', g.id)
      .is('left_at', null)
      .is('volunteer_signup_confirmed_at', null)
      .is('volunteer_signup_nudged_at', null);
    const need = (members ?? []).filter(isAccepted).map((m) => m.user_id as string);
    if (need.length === 0) continue;
    await createNotifications(
      need.map((uid) => ({
        user_id: uid,
        type: 'availability_reminder' as const,
        title_en: '⏰ Confirm your 1365 signup',
        title_ko: '⏰ 1365 신청을 확인해 주세요',
        body_en: `Tap "I'm registered" by ${formatKst(g.volunteer_signup_deadline as string, 'en')} to keep your spot in the group.`,
        body_ko: `${formatKst(g.volunteer_signup_deadline as string, 'ko')}까지 "신청 완료"를 눌러야 그룹에 남을 수 있어요.`,
        action_url: `/matches/${g.id}/volunteer`,
        is_important: true,
      })),
    );
    await admin
      .from('group_members')
      .update({ volunteer_signup_nudged_at: new Date().toISOString() })
      .eq('group_id', g.id)
      .in('user_id', need);
    nudged += need.length;
  }
  return { ok: true as const, nudged };
}

// ---------------------------------------------------------------------------
// Page data
// ---------------------------------------------------------------------------

export async function getVolunteerQuestView(userId: string, groupId: string) {
  const admin = getAdmin();
  const { data: group } = await admin
    .from('groups')
    .select('id, city, phase, quest_type, is_pending_invites, voting_phase_ends_at, quest_scheduled_at, completed_at, volunteer_signup_deadline, volunteer_signup_closed_at')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || group.quest_type !== 'volunteer') return { ok: false as const, status: 404, error: 'not_found' };

  const { data: members } = await admin
    .from('group_members')
    .select('user_id, invite_state, accepted_at, left_at, volunteer_signup_confirmed_at, profiles:profiles!inner(display_name, photo_url)')
    .eq('group_id', groupId);
  const me = (members ?? []).find((m) => m.user_id === userId);
  if (!me || !isAccepted(me)) return { ok: false as const, status: 403, error: 'not_a_member' };
  const completedAt = (group.completed_at as string | null) ?? null;
  // Someone who left before the end still sees the outcome, but not the group's photos.
  const meLeft = group.phase !== 'cancelled' && !inAtEnd(me, completedAt);

  const [{ data: quest }, { data: slots }, { data: votes }, { data: proofs }] = await Promise.all([
    admin.from('quests').select('id, status, volunteer_program_id').eq('group_id', groupId).maybeSingle(),
    admin.from('candidate_slots').select('id, slot_time, volunteer_program_id').eq('group_id', groupId).order('slot_time'),
    admin.from('date_votes').select('user_id, candidate_slot_id').eq('group_id', groupId),
    admin.from('volunteer_proofs').select('id, user_id, kind, storage_path, tagged_user_ids, created_at').eq('group_id', groupId).order('created_at'),
  ]);

  const programIds = [
    ...new Set([...(slots ?? []).map((s) => s.volunteer_program_id as string), quest?.volunteer_program_id as string].filter(Boolean)),
  ];
  const { data: programs } = programIds.length
    ? await admin
        .from('volunteer_programs')
        .select('id, title, title_en, org_name, org_name_en, place, place_en, category, program_start, program_end, act_begin_hour, act_end_hour, recruit_count, applied_count, description, description_en, detail_url, contact_phone, lalo:raw->>areaLalo1')
        .in('id', programIds)
    : { data: [] };

  const signed = await Promise.all(
    (meLeft ? [] : proofs ?? []).map(async (p) => {
      const { data } = await admin.storage.from(PROOF_BUCKET).createSignedUrl(p.storage_path as string, 60 * 60);
      return { ...p, url: data?.signedUrl ?? null };
    }),
  );

  // 1365 gives the activity's exact spot as "lat,lng" (areaLalo1); only real Korean coordinates are passed on.
  const withPoint = (programs ?? []).map((row) => {
    const { lalo, ...p } = row as typeof row & { lalo: string | null };
    const [lat, lng] = String(lalo ?? '').split(',').map((v) => Number(v.trim()));
    const ok = Number.isFinite(lat) && Number.isFinite(lng) && lat > 33 && lat < 39 && lng > 124 && lng < 132;
    return { ...p, lat: ok ? lat : null, lng: ok ? lng : null };
  });

  return {
    ok: true as const,
    me: userId,
    me_left: meLeft,
    group,
    quest,
    programs: withPoint,
    slots: slots ?? [],
    votes: votes ?? [],
    proofs: signed,
    members: (members ?? [])
      .filter((m) => isAccepted(m) && inAtEnd(m, completedAt))
      .map((m) => ({
        user_id: m.user_id,
        display_name: (m.profiles as unknown as { display_name: string })?.display_name ?? '',
        photo_url: (m.profiles as unknown as { photo_url: string | null })?.photo_url ?? null,
        signed_up: !!m.volunteer_signup_confirmed_at,
        left: !!m.left_at,
      })),
    windows: {
      selfie_opens_before_min: SELFIE_OPENS_BEFORE_MIN,
      selfie_closes_after_hours: SELFIE_CLOSES_AFTER_HOURS,
      certificate_days: CERTIFICATE_DAYS,
    },
  };
}
