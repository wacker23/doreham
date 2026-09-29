'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { supabase } from '@/lib/supabase/client';
import { volunteerCategoryLabel } from '@/lib/volunteerCategories';

/**
 * Volunteer quest page (봉사 퀘스트):
 *   voting    → pick one 1365 activity together
 *   scheduled → sign up on 1365 + "I'm registered" (24h), then ONE group selfie on the day
 *   completed → thank-you, selfie, optional 1365 certificate, reviews
 */

type Program = {
  id: string;
  title: string;
  title_en: string | null;
  org_name: string | null;
  org_name_en: string | null;
  place: string | null;
  place_en: string | null;
  category: string | null;
  program_start: string | null;
  program_end: string | null;
  act_begin_hour: number | null;
  act_end_hour: number | null;
  recruit_count: number | null;
  applied_count: number | null;
  description: string | null;
  description_en: string | null;
  detail_url: string | null;
  lat: number | null;
  lng: number | null;
  contact_phone: string | null;
};
type Slot = { id: string; slot_time: string; volunteer_program_id: string | null };
type Vote = { user_id: string; candidate_slot_id: string };
type Member = { user_id: string; display_name: string; photo_url: string | null; signed_up: boolean; left: boolean };
type Proof = { id: string; user_id: string; kind: 'group_selfie' | 'certificate'; tagged_user_ids: string[]; created_at: string; url: string | null };
type View = {
  me: string;
  me_left: boolean;
  group: {
    id: string;
    phase: string;
    is_pending_invites: boolean;
    voting_phase_ends_at: string | null;
    quest_scheduled_at: string | null;
    volunteer_signup_deadline: string | null;
    volunteer_signup_closed_at: string | null;
  };
  quest: { id: string; status: string; volunteer_program_id: string | null } | null;
  programs: Program[];
  slots: Slot[];
  votes: Vote[];
  members: Member[];
  proofs: Proof[];
  windows: { selfie_opens_before_min: number; selfie_closes_after_hours: number; certificate_days: number };
};

const ERRORS: Record<string, { en: string; ko: string }> = {
  signup_closed: { en: 'The signup window has closed.', ko: '신청 확인 기간이 끝났어요.' },
  signup_not_open: { en: 'Signup opens after your group picks an activity.', ko: '그룹이 활동을 고른 뒤에 신청할 수 있어요.' },
  too_early: { en: 'The group selfie opens 1 hour before the activity starts.', ko: '단체 사진은 활동 시작 1시간 전부터 올릴 수 있어요.' },
  too_late: { en: 'The upload window for this activity has closed.', ko: '이 활동의 업로드 기간이 끝났어요.' },
  photo_required: { en: 'Please upload a photo (JPG, PNG or HEIC).', ko: '사진 파일(JPG, PNG, HEIC)을 올려 주세요.' },
  unsupported_file: { en: 'Please upload a photo or PDF.', ko: '사진 또는 PDF 파일을 올려 주세요.' },
  file_too_large: { en: 'The file is larger than 10 MB.', ko: '파일이 10MB보다 커요.' },
  not_a_member: { en: "You're not a member of this group.", ko: '이 그룹의 멤버가 아니에요.' },
};

function fmt(iso: string, lang: 'en' | 'ko', opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', ...opts });
}
const DAY_TIME: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };

export default function VolunteerQuestPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const params = useParams();
  const groupId = params?.group_id as string;

  const [lang, setLang] = useLang();
  const [view, setView] = useState<View | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tagged, setTagged] = useState<Set<string>>(new Set());
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [showKorean, setShowKorean] = useState<Set<string>>(new Set()); // programs shown in the original Korean
  const [expanded, setExpanded] = useState<Set<string>>(new Set());     // programs with the full description open
  const toggleIn = (setter: typeof setShowKorean, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const [now, setNow] = useState(() => Date.now());
  const selfieInput = useRef<HTMLInputElement>(null);
  const certInput = useRef<HTMLInputElement>(null);

  const t = useCallback((en: string, ko: string) => (lang === 'ko' ? ko : en), [lang]);
  const errText = useCallback(
    (code: string) => (ERRORS[code] ? (lang === 'ko' ? ERRORS[code].ko : ERRORS[code].en) : code),
    [lang],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const resp = await fetch(`/api/volunteer/${groupId}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'load_failed');
      setView(data as View);
      // Default selfie tags: everyone still in the group. Keep the user's own choices on live reloads.
      const activeIds = (data as View).members.filter((m) => !m.left).map((m) => m.user_id);
      setTagged((prev) => (prev.size ? new Set([...prev].filter((id) => activeIds.includes(id))) : new Set(activeIds)));
    } catch (e: unknown) {
      setError(errText(e instanceof Error ? e.message : 'load_failed'));
    }
    setLoadingData(false);
  }, [groupId, errText]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push(`/sign-in?return=/matches/${groupId}/volunteer`); return; }
    load();
  }, [user, loading, groupId, router, load]);

  // Live updates while voting / signing up
  useEffect(() => {
    if (!user || !groupId) return;
    const channel = supabase
      .channel(`volunteer:${groupId}:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_votes', filter: `group_id=eq.${groupId}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, groupId, load]);

  // Tick so the selfie window opens/closes without a reload
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const programById = useMemo(() => {
    const m: Record<string, Program> = {};
    for (const p of view?.programs ?? []) m[p.id] = p;
    return m;
  }, [view]);

  if (loading || loadingData) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--jade); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="err-wrap">
        <div className="err-icon">⚠️</div>
        <p>{error ?? t('Something went wrong.', '문제가 생겼어요.')}</p>
        <a href="/matches" className="btn-back">{t('Back to matches', '매칭으로 돌아가기')}</a>
        <style jsx>{`
          .err-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
          .err-icon { font-size: 48px; margin-bottom: 12px; }
          .btn-back { background: var(--ink); color: var(--paper); text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; }
        `}</style>
      </main>
    );
  }

  const { group, members, slots, votes, proofs } = view;
  const me = members.find((m) => m.user_id === view.me);
  const activeMembers = members.filter((m) => !m.left);
  const myVote = votes.find((v) => v.user_id === view.me)?.candidate_slot_id ?? null;
  const chosenProgram = view.quest?.volunteer_program_id ? programById[view.quest.volunteer_program_id] : null;
  const start = group.quest_scheduled_at ? new Date(group.quest_scheduled_at).getTime() : null;
  const selfieOpen = start != null && now >= start - view.windows.selfie_opens_before_min * 60_000 && now <= start + view.windows.selfie_closes_after_hours * 3_600_000;
  const selfieNotYet = start != null && now < start - view.windows.selfie_opens_before_min * 60_000;
  const certOpen = start != null && now >= start - view.windows.selfie_opens_before_min * 60_000 && now <= start + view.windows.certificate_days * 86_400_000;
  const selfies = proofs.filter((p) => p.kind === 'group_selfie');
  const myCert = proofs.find((p) => p.kind === 'certificate' && p.user_id === view.me);
  const signupOpen = group.phase === 'scheduled' && !group.volunteer_signup_closed_at;

  async function vote(slotId: string) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.from('date_votes').delete().eq('group_id', groupId).eq('user_id', user.id);
      const { error: insErr } = await supabase.from('date_votes').insert({ group_id: groupId, user_id: user.id, candidate_slot_id: slotId });
      if (insErr) throw new Error(insErr.message);
      // Lock as soon as everyone has voted (the server re-checks).
      await fetch('/api/lock-quest-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'vote_failed');
    }
    setBusy(false);
  }

  async function signup(action: 'registered' | 'no_spot') {
    if (busy) return;
    if (action === 'no_spot' && !confirm(t(
      "Leave this volunteer group because you couldn't get a 1365 spot? There's no strike.",
      '1365 신청을 못 해서 이 봉사 그룹에서 나갈까요? 경고는 없어요.',
    ))) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch('/api/volunteer/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, action }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'signup_failed');
      if (action === 'no_spot') { router.push('/matches'); return; }
      await load();
    } catch (e: unknown) {
      setError(errText(e instanceof Error ? e.message : 'signup_failed'));
    }
    setBusy(false);
  }

  async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 120000 },
      );
    });
  }

  async function upload(kind: 'group_selfie' | 'certificate', file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append('group_id', groupId);
      form.append('kind', kind);
      form.append('file', file);
      if (kind === 'group_selfie') {
        form.append('tagged_user_ids', JSON.stringify([...tagged]));
        const pos = await currentPosition(); // optional, helps if there's ever a dispute
        if (pos) { form.append('latitude', String(pos.lat)); form.append('longitude', String(pos.lng)); }
      }
      const resp = await fetch('/api/volunteer/proof', { method: 'POST', body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'upload_failed');
      setSelfieFile(null);
      setNotice(kind === 'group_selfie'
        ? (data.completed
            ? t('🎉 Quest complete! Thank you for volunteering together.', '🎉 퀘스트 완료! 함께 봉사해 주셔서 고마워요.')
            : t('Photo uploaded.', '사진을 올렸어요.'))
        : t('Certificate added. Thank you!', '확인서를 등록했어요. 고마워요!'));
      await load();
    } catch (e: unknown) {
      setError(errText(e instanceof Error ? e.message : 'upload_failed'));
    }
    setBusy(false);
  }

  // Plain render helper (not a component) so it doesn't remount on every render.
  // Its classes are styled via `.vq-wrap :global(...)` below because styled-jsx only scopes the main tree.
  // 1365 is Korean-only: in English mode we show the cached English version (when there is one) and keep
  // the Korean place name visible, since that is what people type into a map or show a taxi driver.
  function programBlock(p: Program, slotTime?: string | null) {
    const spots = p.recruit_count != null && p.applied_count != null ? p.recruit_count - p.applied_count : null;
    const hasEnglish = !!p.title_en;
    const english = lang === 'en' && hasEnglish && !showKorean.has(p.id);
    const title = english ? p.title_en! : p.title;
    const org = english ? (p.org_name_en || p.org_name) : p.org_name;
    const place = english ? (p.place_en || p.place) : p.place;
    const description = english ? (p.description_en || p.description) : p.description;
    const category = volunteerCategoryLabel(p.category, lang === 'en' && !showKorean.has(p.id) ? 'en' : 'ko');
    const isOpen = expanded.has(p.id);
    const LIMIT = 260;
    return (
      <div className="program">
        {category && <div className="program-cat">{category}</div>}
        <div className="program-title">{title}</div>
        {slotTime && <div className="program-when">📅 {fmt(slotTime, lang, DAY_TIME)}{p.act_end_hour != null ? ` – ${p.act_end_hour}:00` : ''}</div>}
        {place && (
          <div className="program-line">
            📍 {place}
            {english && p.place && p.place !== place && <div className="program-ko">{p.place}</div>}
            {p.lat != null && p.lng != null && (
              // Exact spot from 1365's coordinates. No coordinates → no link (the 1365 page has a map).
              <a
                className="program-map"
                href={`https://map.kakao.com/link/map/${encodeURIComponent((p.org_name || p.place || '봉사활동').replace(/,/g, ' '))},${p.lat},${p.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Map ↗', '지도 ↗')}
              </a>
            )}
          </div>
        )}
        {org && <div className="program-line">🏢 {org}</div>}
        {spots != null && (
          <div className="program-line">👥 {t(`${spots} spots left on 1365`, `1365 잔여 ${spots}자리`)}</div>
        )}
        {description && (
          <div className="program-desc">
            {isOpen || description.length <= LIMIT ? description : `${description.slice(0, LIMIT)}…`}
            {description.length > LIMIT && (
              <button className="program-more" onClick={() => toggleIn(setExpanded, p.id)}>
                {isOpen ? t('Show less', '접기') : t('Read more', '더 보기')}
              </button>
            )}
          </div>
        )}
        <div className="program-links">
          {p.detail_url && (
            <a href={p.detail_url} target="_blank" rel="noopener noreferrer" className="link-1365">
              {t('View on 1365 ↗', '1365에서 보기 ↗')}
            </a>
          )}
          {lang === 'en' && hasEnglish && (
            <button className="program-orig" onClick={() => toggleIn(setShowKorean, p.id)}>
              {showKorean.has(p.id) ? 'Show English' : 'Show original (Korean)'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="vq-wrap">
      <header className="vq-header">
        <a href="/matches" className="back-btn">←</a>
        <div className="header-title">🤝 {t('Volunteer quest', '봉사 퀘스트')}</div>
        <div className="lang-toggle">
          <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        </div>
      </header>

      <div className="content">
        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error-banner">{error}</div>}

        {view.me_left && (
          <section className="card center">
            <div className="big-emoji">👋</div>
            <h2>{t("You're no longer in this volunteer group", '이 봉사 그룹에서 나왔어요')}</h2>
            <p className="hint">{t('You can request a new quest any time.', '언제든 새 퀘스트를 요청할 수 있어요.')}</p>
            <a href="/matches" className="btn btn-ink">{t('Back to matches', '매칭으로 돌아가기')}</a>
          </section>
        )}

        {!view.me_left && (<>
        {/* ---------------- waiting ---------------- */}
        {group.phase === 'availability' && (
          <section className="card center">
            <div className="big-emoji">⏳</div>
            <h2>{group.is_pending_invites ? t('Waiting for everyone to accept', '모두의 수락을 기다리는 중') : t('Finding activities for your group…', '그룹에 맞는 봉사활동을 찾는 중…')}</h2>
          </section>
        )}

        {/* ---------------- voting ---------------- */}
        {group.phase === 'voting' && (
          <section>
            <h2 className="section-title">{t('Vote on where to volunteer', '어디서 봉사할지 투표해 주세요')}</h2>
            <p className="hint">
              {t(
                `${votes.length} of ${activeMembers.length} voted`,
                `${activeMembers.length}명 중 ${votes.length}명 투표`,
              )}
              {group.voting_phase_ends_at && ` · ${t('closes', '마감')} ${fmt(group.voting_phase_ends_at, lang, DAY_TIME)}`}
            </p>
            {slots.map((s) => {
              const p = s.volunteer_program_id ? programById[s.volunteer_program_id] : null;
              if (!p) return null;
              const count = votes.filter((v) => v.candidate_slot_id === s.id).length;
              const mine = myVote === s.id;
              return (
                <div key={s.id} className={`card option ${mine ? 'mine' : ''}`}>
                  {programBlock(p, s.slot_time)}
                  <div className="option-foot">
                    <span className="votes">🗳️ {count}</span>
                    <button className={`btn ${mine ? 'btn-outline' : 'btn-jade'}`} disabled={busy || mine} onClick={() => vote(s.id)}>
                      {mine ? t('Your vote ✓', '내 투표 ✓') : t('Vote for this', '여기에 투표')}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ---------------- scheduled ---------------- */}
        {group.phase === 'scheduled' && chosenProgram && (
          <section>
            <div className="card">
              <div className="label">{t('Your activity', '우리 봉사활동')}</div>
              {programBlock(chosenProgram, group.quest_scheduled_at)}
            </div>

            {signupOpen && me && !me.left && (
              <div className="card">
                <h3>{t('Step 1 · Sign up on 1365', '1단계 · 1365에서 신청하기')}</h3>
                <p className="hint">
                  {t(
                    'Each of you signs up yourself on 1365 (free). Pick the same date as your group.',
                    '각자 1365에서 직접 신청해 주세요 (무료). 그룹과 같은 날짜를 선택하세요.',
                  )}
                  {group.volunteer_signup_deadline && (
                    <> {t('Confirm by', '확인 마감')} <b>{fmt(group.volunteer_signup_deadline, lang, DAY_TIME)}</b>.</>
                  )}
                </p>
                {chosenProgram.detail_url && (
                  <a href={chosenProgram.detail_url} target="_blank" rel="noopener noreferrer" className="btn btn-jade block">
                    {t('Open 1365 signup ↗', '1365 신청 페이지 열기 ↗')}
                  </a>
                )}
                {lang === 'en' && (
                  <details className="howto">
                    <summary>How to sign up on 1365 (the site is in Korean)</summary>
                    <ol>
                      <li>Tap <b>로그인</b> (Log in). No account yet? Tap <b>회원가입</b> (Sign up). Foreign residents can join with their Residence Card (외국인등록증).</li>
                      <li>On the activity page, tap <b>신청하기</b> (Apply).</li>
                      {group.quest_scheduled_at && (
                        <li>Pick <b>{fmt(group.quest_scheduled_at, 'ko', { month: 'long', day: 'numeric', weekday: 'short' })}</b> ({fmt(group.quest_scheduled_at, 'en', { month: 'short', day: 'numeric', weekday: 'short' })}), the same day as your group, and submit.</li>
                      )}
                      <li>Some organizations approve each application. If the listing asks you to, call them to confirm before you go.</li>
                      <li>Come back here and tap <b>I&apos;m registered</b>.</li>
                    </ol>
                  </details>
                )}
                {me.signed_up ? (
                  <div className="done">✅ {t("You're registered", '신청 완료')}</div>
                ) : (
                  <>
                    <button className="btn btn-ink block" disabled={busy} onClick={() => signup('registered')}>
                      {t("I'm registered ✓", '신청 완료했어요 ✓')}
                    </button>
                    <button className="btn-text" disabled={busy} onClick={() => signup('no_spot')}>
                      {t("I couldn't get a spot (leave, no strike)", '자리가 없어 신청하지 못했어요 (경고 없이 나가기)')}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="card">
              <h3>{t('Your group', '우리 그룹')}</h3>
              <div className="members">
                {activeMembers.map((m) => (
                  <div key={m.user_id} className="member">
                    {m.photo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photo_url} alt="" className="avatar" />
                      : <div className="avatar fallback">{m.display_name[0]?.toUpperCase()}</div>}
                    <div className="member-name">{m.display_name}{m.user_id === view.me ? ` (${t('you', '나')})` : ''}</div>
                    <div className={`member-status ${m.signed_up ? 'ok' : ''}`}>
                      {m.signed_up ? t('1365 ✓', '1365 ✓') : t('not yet', '아직')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(!signupOpen || me?.signed_up) && (
              <div className="card">
                <h3>{t('Step 2 · One group selfie on the day', '2단계 · 당일 단체 사진 한 장')}</h3>
                <p className="hint">
                  {t(
                    "When you're together at the activity, one person takes a group selfie and tags who's in it. That's all — no paperwork needed.",
                    '봉사 장소에 모이면 한 명이 단체 사진을 찍고 사진 속 멤버를 선택해 주세요. 그게 전부예요 — 서류는 필요 없어요.',
                  )}
                </p>
                {selfieNotYet && group.quest_scheduled_at && (
                  <div className="window">
                    ⏱️ {t('Opens', '열리는 시간')} {fmt(new Date(new Date(group.quest_scheduled_at).getTime() - view.windows.selfie_opens_before_min * 60_000).toISOString(), lang, DAY_TIME)}
                  </div>
                )}
                {selfieOpen && (
                  <>
                    <div className="tag-list">
                      {activeMembers.map((m) => (
                        <label key={m.user_id} className="tag">
                          <input
                            type="checkbox"
                            checked={tagged.has(m.user_id) || m.user_id === view.me}
                            disabled={m.user_id === view.me}
                            onChange={(e) => {
                              const next = new Set(tagged);
                              if (e.target.checked) next.add(m.user_id); else next.delete(m.user_id);
                              setTagged(next);
                            }}
                          />
                          {m.display_name}
                        </label>
                      ))}
                    </div>
                    <input
                      ref={selfieInput}
                      type="file"
                      accept="image/*"
                      capture="user"
                      hidden
                      onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                    />
                    {selfieFile ? (
                      <>
                        <div className="picked">🖼️ {selfieFile.name}
                          <button className="btn-link" disabled={busy} onClick={() => selfieInput.current?.click()}>{t('Retake', '다시 찍기')}</button>
                        </div>
                        <button className="btn btn-jade block" disabled={busy} onClick={() => upload('group_selfie', selfieFile)}>
                          {busy ? t('Uploading…', '올리는 중…') : t('Upload group selfie', '단체 사진 올리기')}
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-jade block" disabled={busy} onClick={() => selfieInput.current?.click()}>
                        📸 {t('Take the group selfie', '단체 사진 찍기')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ---------------- completed ---------------- */}
        {group.phase === 'completed' && (
          <section>
            <div className="card center">
              <div className="big-emoji">🌟</div>
              <h2>{t('You volunteered together!', '함께 봉사했어요!')}</h2>
              {chosenProgram && (
                <p className="hint">{lang === 'en' && chosenProgram.title_en ? chosenProgram.title_en : chosenProgram.title}</p>
              )}
            </div>
            {selfies.map((s) => s.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={s.url} alt="" className="selfie" />
            ))}
            {view.quest && (
              <a href={`/matches/review/${view.quest.id}`} className="btn btn-ink block">
                {t('Leave quick reviews', '간단한 리뷰 남기기')}
              </a>
            )}
          </section>
        )}

        {/* ---------------- optional 1365 certificate ---------------- */}
        {(group.phase === 'scheduled' || group.phase === 'completed') && certOpen && (
          <div className="card soft">
            <h3>{t('1365 certificate (optional)', '1365 봉사확인서 (선택)')}</h3>
            <p className="hint">
              {t(
                "Not required. If you like, add your 봉사활동 확인서 from 1365 — it shows a ✓ badge on your profile later.",
                '필수가 아니에요. 원하면 1365의 봉사활동 확인서를 올려 주세요.',
              )}
            </p>
            {myCert ? (
              <div className="done">✅ {t('Certificate added', '확인서 등록 완료')}</div>
            ) : (
              <>
                <input
                  ref={certInput}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload('certificate', f); }}
                />
                <button className="btn btn-outline block" disabled={busy} onClick={() => certInput.current?.click()}>
                  {t('Add certificate', '확인서 올리기')}
                </button>
              </>
            )}
          </div>
        )}

        {/* ---------------- cancelled ---------------- */}
        {group.phase === 'cancelled' && (
          <section className="card center">
            <div className="big-emoji">😔</div>
            <h2>{t('This volunteer quest was closed', '이번 봉사 퀘스트는 종료되었어요')}</h2>
            <p className="hint">{t('No strike for you. You can request a new quest any time.', '경고는 없어요. 언제든 새 퀘스트를 요청할 수 있어요.')}</p>
            <a href="/matches" className="btn btn-ink">{t('Back to matches', '매칭으로 돌아가기')}</a>
          </section>
        )}

        {group.phase !== 'cancelled' && (
          <a href={`/matches/${groupId}/chat`} className="btn btn-outline block">💬 {t('Group chat', '그룹 채팅')}</a>
        )}
        </>)}
      </div>

      <style jsx>{`
        .vq-wrap { min-height: 100vh; background: var(--paper); }
        .vq-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .back-btn { text-decoration: none; color: var(--ink); font-size: 20px; }
        .header-title { font-family: var(--display); font-weight: 800; font-size: 17px; flex: 1; }
        .lang-toggle { display: flex; gap: 4px; }
        .lang-toggle button { border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 5px 10px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink-60); }
        .lang-toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .content { max-width: 520px; margin: 0 auto; padding: 20px 16px 48px; }
        .section-title { font-family: var(--display); font-weight: 800; font-size: 20px; margin: 4px 0 4px; }
        h2 { font-family: var(--display); font-weight: 800; font-size: 20px; margin: 8px 0; }
        h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0 0 8px; }
        .hint { color: var(--ink-60); font-size: 14px; line-height: 1.6; margin: 0 0 12px; }
        .card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 18px; margin-bottom: 14px; }
        .card.soft { background: var(--paper-2); }
        .card.center { text-align: center; }
        .card.option.mine { border-color: var(--jade); box-shadow: 0 0 0 2px rgba(15, 157, 119, 0.15); }
        .big-emoji { font-size: 44px; }
        .label { font-size: 12px; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .vq-wrap :global(.program-title) { font-family: var(--display); font-weight: 800; font-size: 18px; color: var(--ink); margin-bottom: 6px; line-height: 1.35; }
        .vq-wrap :global(.program-when) { font-weight: 700; color: var(--jade); font-size: 14px; margin-bottom: 6px; }
        .vq-wrap :global(.program-line) { color: var(--ink-60); font-size: 13.5px; margin-bottom: 3px; }
        .vq-wrap :global(.program-desc) { color: var(--ink-60); font-size: 13px; line-height: 1.55; margin-top: 8px; white-space: pre-line; }
        .vq-wrap :global(.program-cat) { display: inline-block; font-size: 11.5px; font-weight: 700; color: var(--jade); background: rgba(15, 157, 119, 0.08); border-radius: 999px; padding: 3px 10px; margin-bottom: 8px; }
        .vq-wrap :global(.program-ko) { font-size: 12.5px; color: var(--ink-60); margin: 2px 0 0 20px; }
        .vq-wrap :global(.program-map) { display: inline-block; margin-left: 20px; font-size: 12.5px; font-weight: 700; color: var(--jade); text-decoration: none; }
        .vq-wrap :global(.program-more) { display: block; margin-top: 6px; background: none; border: 0; padding: 0; color: var(--jade); font-weight: 700; font-size: 13px; cursor: pointer; }
        .vq-wrap :global(.program-links) { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 10px; }
        .vq-wrap :global(.program-orig) { background: none; border: 0; padding: 0; color: var(--ink-60); font-size: 13px; text-decoration: underline; cursor: pointer; }
        .howto { margin-top: 12px; font-size: 13.5px; color: var(--ink); background: var(--paper-2); border-radius: 12px; padding: 10px 14px; }
        .howto summary { cursor: pointer; font-weight: 700; }
        .howto ol { margin: 10px 0 2px; padding-left: 20px; line-height: 1.6; }
        .howto li { margin-bottom: 6px; }
        .vq-wrap :global(.link-1365) { display: inline-block; font-size: 13px; font-weight: 700; color: var(--jade); text-decoration: none; }
        .option-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
        .votes { font-weight: 700; color: var(--ink-60); }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 12px; padding: 12px 18px; font-weight: 700; font-size: 15px; cursor: pointer; text-decoration: none; }
        .btn.block { display: flex; width: 100%; margin-top: 10px; box-sizing: border-box; }
        .btn:disabled { opacity: 0.55; cursor: default; }
        .btn-jade { background: linear-gradient(135deg, #0f9d77, #34c39a); color: #fff; }
        .btn-ink { background: var(--ink); color: var(--paper); }
        .btn-outline { background: #fff; color: var(--ink); border: 1.5px solid var(--ink-12); }
        .btn-text { display: block; width: 100%; margin-top: 10px; background: transparent; border: 0; color: var(--ink-60); font-size: 13px; text-decoration: underline; cursor: pointer; }
        .done { margin-top: 12px; font-weight: 700; color: var(--jade); }
        .members { display: flex; flex-direction: column; gap: 10px; }
        .member { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
        .avatar.fallback { display: flex; align-items: center; justify-content: center; background: var(--paper-2); font-weight: 700; }
        .member-name { flex: 1; font-weight: 600; }
        .member-status { font-size: 12.5px; color: var(--ink-60); }
        .member-status.ok { color: var(--jade); font-weight: 700; }
        .window { background: rgba(15, 157, 119, 0.08); color: var(--jade); padding: 12px 14px; border-radius: 12px; font-weight: 600; }
        .tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
        .tag { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--ink-12); border-radius: 999px; font-size: 14px; background: var(--paper-2); }
        .picked { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; font-size: 13.5px; color: var(--ink-60); word-break: break-all; }
        .btn-link { background: none; border: 0; color: var(--jade); font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .selfie { width: 100%; border-radius: 16px; margin-bottom: 14px; }
        .notice { background: rgba(15, 157, 119, 0.1); color: var(--jade); padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; font-weight: 600; }
        .error-banner { background: rgba(255, 106, 61, 0.1); border: 1px solid rgba(255, 106, 61, 0.25); color: var(--persimmon); padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; font-size: 14px; }
      `}</style>
    </main>
  );
}
