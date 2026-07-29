'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Phase = 'availability' | 'voting' | 'scheduled' | 'cancelled';

type VenueHours = Record<
  'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  { open?: string; close?: string; closed: boolean }
>;

type Slot = { iso: string; label: string; hourStart: number };
type DayGroup = { dateStr: string; dateLabel: string; slots: Slot[] };
type MemberInfo = {
  user_id: string;
  display_name: string;
  color: string;
  slots: Set<string>;
};

type Candidate = {
  id: string;
  slot_time: string;
  available_user_ids: string[];
};

type Vote = {
  user_id: string;
  candidate_slot_id: string;
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MEMBER_COLORS = ['#0F9D77', '#5B7CFA', '#B45FBB', '#E8A93F', '#DC5A6E'];

function pad(n: number) { return n.toString().padStart(2, '0'); }
function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function formatHour(hour: number, lang: 'en' | 'ko'): string {
  if (lang === 'ko') return `${hour}:00`;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:00 ${suffix}`;
}

function formatSlotFull(iso: string, lang: 'en' | 'ko'): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
  const timeStr = formatHour(d.getHours(), lang);
  const endHour = d.getHours() + 2;
  const endTime = formatHour(endHour, lang);
  return `${dateStr}, ${timeStr} — ${endTime}`;
}

function generateAvailableSlots(hours: VenueHours, lang: 'en' | 'ko'): DayGroup[] {
  const days: DayGroup[] = [];
  const now = new Date();
  now.setMinutes(0, 0, 0);

  for (let d = 0; d < 14; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const weekdayKey = WEEKDAY_KEYS[date.getDay()];
    const dayHours = hours[weekdayKey];
    if (!dayHours || dayHours.closed || !dayHours.open || !dayHours.close) continue;

    const openMin = parseTimeToMinutes(dayHours.open);
    const closeMin = parseTimeToMinutes(dayHours.close);
    const firstStartMin = openMin + 60;
    const lastValidStartMin = closeMin - 120;
    if (lastValidStartMin < firstStartMin) continue;

    const slots: Slot[] = [];
    for (let m = firstStartMin; m <= lastValidStartMin; m += 120) {
      const hour = Math.floor(m / 60);
      const slotDate = new Date(date);
      slotDate.setHours(hour, m % 60, 0, 0);
      if (slotDate.getTime() < Date.now()) continue;
      slots.push({ iso: slotDate.toISOString(), label: formatHour(hour, lang), hourStart: hour });
    }
    if (slots.length === 0) continue;

    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const dateLabel = date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    days.push({ dateStr, dateLabel, slots });
  }
  return days;
}

export default function AvailabilityPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Group data
  const [phase, setPhase] = useState<Phase>('availability');
  const [venueHours, setVenueHours] = useState<VenueHours | null>(null);
  const [venueName, setVenueName] = useState('');
  const [venueId, setVenueId] = useState('');
  const [phaseEndsAt, setPhaseEndsAt] = useState<Date | null>(null);
  const [votingEndsAt, setVotingEndsAt] = useState<Date | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [totalMembers, setTotalMembers] = useState(0);

  // Availability phase
  const [submittedCount, setSubmittedCount] = useState(0);
  const [mySelectedSlots, setMySelectedSlots] = useState<Set<string>>(new Set());
  const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null);
  const [otherMembers, setOtherMembers] = useState<MemberInfo[]>([]);

  // Voting phase
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myVoteId, setMyVoteId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const groupId = params?.group_id as string;

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/sign-in?return=/matches/${groupId}/availability`);
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, groupId]);

  // Realtime updates
  useEffect(() => {
    if (!user || loading) return;

    const channel = supabase
      .channel(`avail-vote:${groupId}:${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'availability_submissions', filter: `group_id=eq.${groupId}` },
        () => { loadAll(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'date_votes', filter: `group_id=eq.${groupId}` },
        () => { loadVotes(); checkAndLockIfComplete(); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        () => { loadAll(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, groupId, loading]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const { data: myMembership } = await supabase
      .from('group_members')
      .select('user_id, accepted_at, left_at')
      .eq('group_id', groupId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!myMembership || !myMembership.accepted_at || myMembership.left_at) {
      setError(lang === 'ko' ? '이 그룹에 접근할 수 없습니다.' : "You don't have access to this group.");
      setLoading(false);
      return;
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('id, phase, availability_phase_ends_at, voting_phase_ends_at, quest_scheduled_at, created_at')
      .eq('id', groupId)
      .maybeSingle();

    if (!groupData) {
      setError(lang === 'ko' ? '그룹을 찾을 수 없습니다.' : 'Group not found.');
      setLoading(false);
      return;
    }

    let currentPhase = (groupData.phase ?? 'availability') as Phase;
    const availEnd = groupData.availability_phase_ends_at
      ? new Date(groupData.availability_phase_ends_at)
      : new Date(new Date(groupData.created_at).getTime() + 24 * 60 * 60 * 1000);
    setPhaseEndsAt(availEnd);

    if (groupData.voting_phase_ends_at) {
      setVotingEndsAt(new Date(groupData.voting_phase_ends_at));
    }
    setScheduledAt(groupData.quest_scheduled_at ?? null);

    // Lazy transition — if we're past availability deadline and still in availability phase, kick the API
    if (currentPhase === 'availability' && Date.now() >= availEnd.getTime()) {
      try {
        const resp = await fetch('/api/compute-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: groupId }),
        });
        const result = await resp.json();
        if (result.phase) currentPhase = result.phase;
      } catch (e) {
        console.error('Compute failed:', e);
      }
    }

    setPhase(currentPhase);

    // Load venue
    const { data: questData } = await supabase
      .from('quests')
      .select('venue_id, venue:venues!inner(business_name_display, hours_json)')
      .eq('group_id', groupId)
      .maybeSingle();

    if (!questData || !(questData as any).venue) {
      setError(lang === 'ko' ? '이 그룹에 지정된 장소가 없습니다.' : 'No venue assigned.');
      setLoading(false);
      return;
    }
    setVenueId((questData as any).venue_id);
    setVenueName((questData as any).venue.business_name_display);
    setVenueHours((questData as any).venue.hours_json as VenueHours);

    // Load members
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('user_id, profiles:profiles!inner(display_name)')
      .eq('group_id', groupId)
      .is('left_at', null)
      .not('accepted_at', 'is', null);

    setTotalMembers(allMembers?.length ?? 0);

    const namesMap: Record<string, string> = {};
    (allMembers as any[])?.forEach((m) => {
      namesMap[m.user_id] = m.profiles?.display_name ?? '?';
    });
    setMemberNames(namesMap);

    // Load submissions (for availability phase display)
    const { data: submissions } = await supabase
      .from('availability_submissions')
      .select('id, user_id, slots')
      .eq('group_id', groupId);

    setSubmittedCount(submissions?.length ?? 0);

    const mine = submissions?.find((s: any) => s.user_id === user!.id);
    if (mine) {
      setExistingSubmissionId(mine.id);
      setMySelectedSlots(new Set(mine.slots as string[]));
    }

    const others: MemberInfo[] = (allMembers as any[])
      .filter((m) => m.user_id !== user!.id)
      .map((m, idx) => {
        const sub = submissions?.find((s: any) => s.user_id === m.user_id);
        return {
          user_id: m.user_id,
          display_name: m.profiles?.display_name ?? '?',
          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
          slots: new Set((sub?.slots as string[]) ?? []),
        };
      });
    setOtherMembers(others);

    // If voting phase, load candidates + votes
    if (currentPhase === 'voting' || currentPhase === 'scheduled') {
      await loadCandidates();
      await loadVotes();
    }

    setLoading(false);
  }

  async function loadCandidates() {
    const { data } = await supabase
      .from('candidate_slots')
      .select('id, slot_time, available_user_ids')
      .eq('group_id', groupId)
      .order('slot_time', { ascending: true });
    if (data) setCandidates(data as Candidate[]);
  }

  async function loadVotes() {
    const { data } = await supabase
      .from('date_votes')
      .select('user_id, candidate_slot_id, id')
      .eq('group_id', groupId);
    if (data) {
      setVotes(data.map((v: any) => ({ user_id: v.user_id, candidate_slot_id: v.candidate_slot_id })));
      const mine = (data as any[]).find((v) => v.user_id === user!.id);
      setMyVoteId(mine?.candidate_slot_id ?? null);
    }
  }

  async function checkAndLockIfComplete() {
    // Called when a vote changes — check if everyone voted and lock
    try {
      const resp = await fetch('/api/lock-quest-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      const result = await resp.json();
      if (result.phase === 'scheduled') {
        loadAll();
      }
    } catch (e) {
      console.error('Lock check failed:', e);
    }
  }

  const availableDays = useMemo(() => {
    if (!venueHours) return [];
    return generateAvailableSlots(venueHours, lang);
  }, [venueHours, lang]);

  function toggleSlot(iso: string) {
    setMySelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
    setSaveSuccess(false);
  }

  function toggleWholeDay(day: DayGroup) {
    const allSelected = day.slots.every((s) => mySelectedSlots.has(s.iso));
    setMySelectedSlots((prev) => {
      const next = new Set(prev);
      if (allSelected) day.slots.forEach((s) => next.delete(s.iso));
      else day.slots.forEach((s) => next.add(s.iso));
      return next;
    });
    setSaveSuccess(false);
  }

  async function saveAvailability() {
    if (mySelectedSlots.size === 0) {
      setError(lang === 'ko' ? '최소 1개 이상의 시간대를 선택해주세요.' : 'Select at least one time slot.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    const slotsArray = Array.from(mySelectedSlots);
    if (existingSubmissionId) {
      const { error: err } = await supabase
        .from('availability_submissions')
        .update({ slots: slotsArray, updated_at: new Date().toISOString() })
        .eq('id', existingSubmissionId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { data, error: err } = await supabase
        .from('availability_submissions')
        .insert({ group_id: groupId, user_id: user!.id, slots: slotsArray })
        .select('id').single();
      if (err) { setError(err.message); setSaving(false); return; }
      if (data) setExistingSubmissionId(data.id);
      setSubmittedCount((c) => c + 1);
    }
    setSaving(false);
    setSaveSuccess(true);

    // Check if this was the last submission — trigger compute if so
    try {
      await fetch('/api/compute-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      // Reload to reflect any phase transition
      loadAll();
    } catch (e) {
      console.error('Compute check failed:', e);
    }
  }

  async function submitVote(candidateId: string) {
    setVoting(true);
    setError(null);

    // Delete old vote if exists, then insert new
    if (myVoteId) {
      await supabase.from('date_votes')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user!.id);
    }

    const { error: err } = await supabase.from('date_votes').insert({
      group_id: groupId,
      user_id: user!.id,
      candidate_slot_id: candidateId,
    });

    if (err) { setError(err.message); setVoting(false); return; }
    setMyVoteId(candidateId);
    setVoting(false);
    await loadVotes();
    await checkAndLockIfComplete();
  }

  // Countdown
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const availTimeLeft = phaseEndsAt ? phaseEndsAt.getTime() - now.getTime() : 0;
  const availPhaseExpired = availTimeLeft <= 0;
  const availHours = Math.floor(availTimeLeft / 3600000);
  const availMinutes = Math.floor((availTimeLeft % 3600000) / 60000);

  const voteTimeLeft = votingEndsAt ? votingEndsAt.getTime() - now.getTime() : 0;
  const votePhaseExpired = voteTimeLeft <= 0;
  const voteHours = Math.floor(voteTimeLeft / 3600000);
  const voteMinutes = Math.floor((voteTimeLeft % 3600000) / 60000);

  function getOthersForSlot(iso: string): MemberInfo[] {
    return otherMembers.filter((m) => m.slots.has(iso));
  }

  function getVotesForCandidate(candidateId: string): Vote[] {
    return votes.filter((v) => v.candidate_slot_id === candidateId);
  }

  if (authLoading || loading) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (error && !venueHours) {
    return (
      <>
        <header className="a-nav">
          <div className="wrap a-nav-in">
            <a className="brand" href="/">Doreham <span className="ko-mark">도레함</span></a>
          </div>
        </header>
        <main className="wrap main-wrap">
          <div className="error-state">
            <div className="error-icon">🔒</div>
            <h2>{error}</h2>
            <button onClick={() => router.push('/matches')} className="btn-primary">
              {lang === 'ko' ? '← 내 그룹으로' : '← Back to matches'}
            </button>
          </div>
        </main>
        <style jsx>{`
          .a-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); }
          .a-nav-in { display: flex; align-items: center; height: 68px; }
          .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
          .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
          .main-wrap { padding: 60px 24px; max-width: 500px; }
          .error-state { text-align: center; padding: 60px 20px; background: var(--paper-2); border-radius: 24px; }
          .error-icon { font-size: 56px; margin-bottom: 20px; }
          .error-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 24px; }
          .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
        `}</style>
      </>
    );
  }

  return (
    <>
      <header className="a-nav">
        <div className="wrap a-nav-in">
          <button className="back-btn" onClick={() => router.push('/matches')}>←</button>
          <div className="header-info">
            <div className="header-title">
              {phase === 'availability' && (lang === 'ko' ? '가능한 시간 선택' : 'Pick your availability')}
              {phase === 'voting' && (lang === 'ko' ? '날짜 투표' : 'Vote on the date')}
              {phase === 'scheduled' && (lang === 'ko' ? '퀘스트 확정' : 'Quest confirmed')}
              {phase === 'cancelled' && (lang === 'ko' ? '매칭 취소됨' : 'Match cancelled')}
            </div>
            <div className="header-sub">📍 {venueName}</div>
          </div>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      </header>

      <main className="wrap main-wrap">

        {/* ==================== PHASE: SCHEDULED ==================== */}
        {phase === 'scheduled' && scheduledAt && (
          <div className="scheduled-hero">
            <div className="scheduled-icon">🎉</div>
            <h2>{lang === 'ko' ? '만날 날이 정해졌어요!' : "You're on!"}</h2>
            <div className="scheduled-time">{formatSlotFull(scheduledAt, lang)}</div>
            <div className="scheduled-venue">📍 {venueName}</div>
            <a href={`/venues/${venueId}`} className="btn-secondary">
              {lang === 'ko' ? '장소 정보 보기' : 'View venue details'}
            </a>
          </div>
        )}

        {/* ==================== PHASE: CANCELLED ==================== */}
        {phase === 'cancelled' && (
          <div className="cancelled-hero">
            <div className="cancelled-icon">😔</div>
            <h2>{lang === 'ko' ? '매칭이 취소되었어요' : 'Match cancelled'}</h2>
            <p>
              {lang === 'ko'
                ? '이번 그룹은 공통된 시간을 찾을 수 없었어요. 걱정 마세요 — 곧 새로운 매칭을 준비하겠습니다.'
                : "This group couldn't find a common time. Don't worry — we'll match you again soon."}
            </p>
            <button onClick={() => router.push('/matches')} className="btn-primary">
              {lang === 'ko' ? '내 그룹으로' : 'Back to matches'}
            </button>
          </div>
        )}

        {/* ==================== PHASE: VOTING ==================== */}
        {phase === 'voting' && (
          <>
            <div className="status-bar">
              <div className="status-item">
                <div className="status-label">{lang === 'ko' ? '투표 현황' : 'Votes'}</div>
                <div className="status-value">{votes.length} / {totalMembers}</div>
              </div>
              <div className="status-item">
                <div className="status-label">{lang === 'ko' ? '마감까지' : 'Time left'}</div>
                <div className={`status-value ${votePhaseExpired ? 'expired' : ''}`}>
                  {votePhaseExpired
                    ? (lang === 'ko' ? '마감됨' : 'Closed')
                    : `${voteHours}h ${voteMinutes}m`}
                </div>
              </div>
            </div>

            <div className="instructions">
              <p>
                {lang === 'ko'
                  ? '아래는 모든 멤버가 가능한 시간입니다. 가장 선호하는 시간을 선택하세요.'
                  : "These are the times everyone can meet. Pick your favorite."}
              </p>
            </div>

            {candidates.length === 0 ? (
              <div className="empty-state">
                {lang === 'ko' ? '후보 시간이 없습니다.' : 'No candidate slots.'}
              </div>
            ) : (
              <div className="candidates-list">
                {candidates.map((c) => {
                  const cVotes = getVotesForCandidate(c.id);
                  const isMyVote = myVoteId === c.id;
                  return (
                    <button
                      key={c.id}
                      className={`candidate-card ${isMyVote ? 'my-vote' : ''}`}
                      onClick={() => !voting && submitVote(c.id)}
                      disabled={voting}
                    >
                      <div className="candidate-time">{formatSlotFull(c.slot_time, lang)}</div>
                      <div className="candidate-meta">
                        <div className="vote-count">
                          {cVotes.length > 0
                            ? `${cVotes.length} ${lang === 'ko' ? '표' : cVotes.length === 1 ? 'vote' : 'votes'}`
                            : (lang === 'ko' ? '아직 투표 없음' : 'No votes yet')}
                        </div>
                        <div className="voters">
                          {cVotes.map((v) => (
                            <span key={v.user_id} className="voter-chip">
                              {memberNames[v.user_id] ?? '?'}
                              {v.user_id === user!.id && (
                                <span className="you-mark">
                                  {' '}({lang === 'ko' ? '나' : 'you'})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      {isMyVote && <div className="my-vote-badge">✓ {lang === 'ko' ? '내 투표' : 'Your vote'}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ==================== PHASE: AVAILABILITY ==================== */}
        {phase === 'availability' && (
          <>
            <div className="status-bar">
              <div className="status-item">
                <div className="status-label">{lang === 'ko' ? '제출 현황' : 'Submissions'}</div>
                <div className="status-value">{submittedCount} / {totalMembers}</div>
              </div>
              <div className="status-item">
                <div className="status-label">{lang === 'ko' ? '마감까지' : 'Time left'}</div>
                <div className={`status-value ${availPhaseExpired ? 'expired' : ''}`}>
                  {availPhaseExpired
                    ? (lang === 'ko' ? '마감됨' : 'Closed')
                    : `${availHours}h ${availMinutes}m`}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="legend">
              <div className="legend-item">
                <span className="legend-swatch me"></span>
                <span>{lang === 'ko' ? '나' : 'You'}</span>
              </div>
              {otherMembers.map((m) => (
                <div key={m.user_id} className="legend-item">
                  <span className="legend-swatch" style={{ backgroundColor: m.color }}></span>
                  <span>{m.display_name}</span>
                  {m.slots.size > 0 && <span className="legend-check">✓</span>}
                </div>
              ))}
            </div>

            <div className="instructions">
              <p>
                {lang === 'ko'
                  ? '다음 14일 동안 가능한 시간을 모두 선택하세요. 다른 멤버가 선택한 시간대에는 색상 점이 표시됩니다.'
                  : "Pick every slot you're available. Colored dots show other members' picks — try to overlap!"}
              </p>
            </div>

            {availableDays.length === 0 ? (
              <div className="empty-state">
                {lang === 'ko' ? '이용 가능한 시간대가 없습니다.' : 'No available slots.'}
              </div>
            ) : (
              <div className="days-list">
                {availableDays.map((day) => {
                  const allSelected = day.slots.every((s) => mySelectedSlots.has(s.iso));
                  return (
                    <div key={day.dateStr} className="day-block">
                      <div className="day-header">
                        <div className="day-label">{day.dateLabel}</div>
                        <button
                          className="select-all-btn"
                          onClick={() => toggleWholeDay(day)}
                          disabled={availPhaseExpired}
                        >
                          {allSelected
                            ? (lang === 'ko' ? '모두 해제' : 'Clear day')
                            : (lang === 'ko' ? '모두 선택' : 'Select all')}
                        </button>
                      </div>
                      <div className="slots-chips">
                        {day.slots.map((slot) => {
                          const isMine = mySelectedSlots.has(slot.iso);
                          const others = getOthersForSlot(slot.iso);
                          const hasOthers = others.length > 0;
                          return (
                            <button
                              key={slot.iso}
                              className={`slot-chip ${isMine ? 'selected' : ''} ${hasOthers ? 'has-others' : ''}`}
                              onClick={() => toggleSlot(slot.iso)}
                              disabled={availPhaseExpired}
                              title={others.length > 0 ? `${others.map((o) => o.display_name).join(', ')}` : ''}
                            >
                              <span>{slot.label}</span>
                              {others.length > 0 && (
                                <span className="dots">
                                  {others.map((o) => (
                                    <span key={o.user_id} className="dot" style={{ backgroundColor: o.color }} />
                                  ))}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && venueHours && <div className="error-msg">{error}</div>}
            {saveSuccess && (
              <div className="success-msg">✓ {lang === 'ko' ? '저장되었습니다!' : 'Saved!'}</div>
            )}

            {!availPhaseExpired && (
              <div className="save-bar">
                <div className="selected-count">
                  {mySelectedSlots.size} {lang === 'ko' ? '개 선택됨' : 'slots selected'}
                </div>
                <button
                  className="btn-save"
                  onClick={saveAvailability}
                  disabled={saving || mySelectedSlots.size === 0}
                >
                  {saving ? (lang === 'ko' ? '저장 중…' : 'Saving…')
                    : existingSubmissionId ? (lang === 'ko' ? '업데이트' : 'Update')
                      : (lang === 'ko' ? '제출' : 'Submit')}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <style jsx>{`
        .a-nav { background: rgba(245, 242, 235, 0.95); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .a-nav-in { display: flex; align-items: center; gap: 12px; height: 68px; }
        .back-btn { background: transparent; border: 0; font-size: 24px; color: var(--ink); cursor: pointer; padding: 8px 12px; font-weight: 300; }
        .header-info { flex: 1; min-width: 0; }
        .header-title { font-family: var(--display); font-weight: 700; font-size: 16px; color: var(--ink); }
        .header-sub { font-size: 12px; color: var(--ink-60); margin-top: 2px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 12px; padding: 6px 10px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .main-wrap { padding: 24px 20px 140px; max-width: 700px; }

        /* Scheduled hero */
        .scheduled-hero { text-align: center; padding: 60px 20px; background: linear-gradient(135deg, rgba(15, 157, 119, 0.08), rgba(255, 106, 61, 0.05)); border: 1px solid rgba(15, 157, 119, 0.2); border-radius: 24px; }
        .scheduled-icon { font-size: 72px; margin-bottom: 16px; }
        .scheduled-hero h2 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 16px; color: var(--ink); }
        .scheduled-time { font-family: var(--display); font-weight: 700; font-size: 24px; color: var(--jade); margin-bottom: 8px; }
        .scheduled-venue { font-size: 16px; color: var(--ink-60); margin-bottom: 24px; }
        .btn-secondary { display: inline-block; background: transparent; border: 1px solid var(--ink-12); color: var(--ink); padding: 10px 22px; border-radius: 999px; font-weight: 600; font-size: 14px; text-decoration: none; }
        .btn-secondary:hover { background: var(--paper-2); }

        /* Cancelled */
        .cancelled-hero { text-align: center; padding: 60px 20px; background: var(--paper-2); border-radius: 24px; }
        .cancelled-icon { font-size: 64px; margin-bottom: 16px; }
        .cancelled-hero h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 12px; color: var(--ink); }
        .cancelled-hero p { color: var(--ink-60); font-size: 15px; margin: 0 0 24px; max-width: 400px; margin-left: auto; margin-right: auto; }
        .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }

        /* Voting phase */
        .candidates-list { display: flex; flex-direction: column; gap: 12px; }
        .candidate-card {
          display: flex; flex-direction: column; gap: 10px;
          background: #fff; border: 2px solid var(--ink-12); border-radius: 16px;
          padding: 18px 20px; text-align: left; cursor: pointer;
          transition: all 0.15s; font-family: var(--body);
        }
        .candidate-card:hover:not(:disabled) { border-color: var(--persimmon); transform: translateY(-1px); }
        .candidate-card.my-vote { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.04); }
        .candidate-card:disabled { opacity: 0.6; cursor: not-allowed; }
        .candidate-time { font-family: var(--display); font-weight: 700; font-size: 17px; color: var(--ink); }
        .candidate-meta { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .vote-count { font-size: 13px; font-weight: 700; color: var(--ink-60); }
        .voters { display: flex; gap: 6px; flex-wrap: wrap; }
        .voter-chip { font-size: 12px; font-weight: 600; color: var(--ink); background: var(--paper-2); padding: 3px 10px; border-radius: 999px; }
        .you-mark { color: var(--persimmon); }
        .my-vote-badge { color: var(--persimmon); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

        /* Availability phase (existing) */
        .status-bar { display: flex; gap: 12px; margin-bottom: 14px; }
        .status-item { flex: 1; background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; padding: 12px 16px; }
        .status-label { font-size: 11px; color: var(--ink-60); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .status-value { font-family: var(--display); font-weight: 800; font-size: 20px; color: var(--ink); }
        .status-value.expired { color: var(--persimmon); }
        .legend { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 16px; background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; margin-bottom: 14px; align-items: center; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink); font-weight: 500; }
        .legend-swatch { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }
        .legend-swatch.me { background: var(--persimmon); }
        .legend-check { color: var(--jade); font-weight: 700; font-size: 12px; margin-left: 2px; }
        .instructions { background: var(--paper-2); border-radius: 14px; padding: 12px 16px; margin-bottom: 20px; }
        .instructions p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink); }
        .empty-state { padding: 40px 20px; background: var(--paper-2); border-radius: 14px; text-align: center; color: var(--ink-60); }
        .days-list { display: flex; flex-direction: column; gap: 14px; }
        .day-block { background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; padding: 16px; }
        .day-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .day-label { font-family: var(--display); font-weight: 700; font-size: 15px; color: var(--ink); }
        .select-all-btn { background: transparent; border: 1px solid var(--ink-12); color: var(--ink-60); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .select-all-btn:hover:not(:disabled) { background: var(--paper-2); color: var(--ink); }
        .select-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .slots-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .slot-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--paper-2); border: 2px solid transparent; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink); transition: all 0.12s; position: relative; }
        .slot-chip:hover:not(:disabled) { border-color: var(--ink-60); }
        .slot-chip.selected { background: var(--persimmon); color: #fff; border-color: var(--persimmon); }
        .slot-chip.has-others:not(.selected) { background: rgba(15, 157, 119, 0.08); border-color: rgba(15, 157, 119, 0.3); }
        .slot-chip:disabled { opacity: 0.5; cursor: not-allowed; }
        .dots { display: inline-flex; gap: 3px; align-items: center; }
        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; box-shadow: 0 0 0 1.5px #fff; }
        .slot-chip.selected .dot { box-shadow: 0 0 0 1.5px var(--persimmon); }
        .error-msg { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-top: 16px; }
        .success-msg { background: rgba(15, 157, 119, 0.1); color: var(--jade); border: 1px solid rgba(15, 157, 119, 0.25); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-top: 16px; text-align: center; font-weight: 600; }
        .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid var(--ink-12); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; box-shadow: 0 -4px 12px rgba(0,0,0,0.04); z-index: 20; }
        .selected-count { font-weight: 600; font-size: 14px; color: var(--ink); }
        .btn-save { background: var(--persimmon); color: #fff; border: 0; padding: 12px 32px; border-radius: 999px; font-weight: 700; font-size: 15px; cursor: pointer; }
        .btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </>
  );
}