'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBar } from '@/components/AppTabBar';
import { cityName } from '@/lib/cities';
import { EVENT_REPORT_REASONS, eventCategory } from '@/lib/eventCategories';
import { dayLabel, eventError, eventText, relativeTime, timeRange } from '@/lib/eventDisplay';
import { initials, type EventDetail, type EventPerson } from '@/lib/eventTypes';
import { levelByNumber } from '@/lib/points';

type ReportTarget = { commentId: string | null } | null;

export default function EventDetailPage() {
  const id = String(useParams()?.id ?? '');
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const [data, setData] = useState<EventDetail | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false); // last action failed for lack of a friend profile
  const [busy, setBusy] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [comment, setComment] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [report, setReport] = useState<ReportTarget>(null);
  const [toast, setToast] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push(`/sign-in?return=/events/${id}`);
  }, [loading, user, router, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL after hydration
    const qs = new URLSearchParams(window.location.search);
    setIsNew(qs.get('new') === '1');
    setPosterFailed(qs.get('poster') === 'failed');
  }, []);

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${id}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setLoadError(j.error || 'not_found');
      return;
    }
    setLoadedAt(Date.now());
    setData(j as EventDetail);
  }, [id]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [user, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function call(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setActionError('');
    setNeedsProfile(false);
    try {
      const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'failed');
      await load();
      return true;
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : '';
      setNeedsProfile(code === 'finish_onboarding');
      setActionError(eventError(code, lang));
      return false;
    } finally {
      setBusy('');
    }
  }

  const setGoing = (going: boolean) => call('going', `/api/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ going }) });

  async function postComment(ev: React.FormEvent) {
    ev.preventDefault();
    if (!comment.trim()) return;
    if (await call('comment', `/api/events/${id}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) })) setComment('');
  }

  const deleteComment = (commentId: string) =>
    call(`del-${commentId}`, `/api/events/${id}/comments?comment_id=${commentId}`, { method: 'DELETE' });

  async function cancelEvent() {
    if (await call('cancel', `/api/events/${id}`, { method: 'DELETE' })) setConfirmCancel(false);
  }

  const moderate = (action: 'feature' | 'unfeature' | 'hide' | 'restore') =>
    call(`mod-${action}`, `/api/events/${id}`, { method: 'PATCH', body: JSON.stringify({ moderate: action }) });

  async function share() {
    const url = `${window.location.origin}/events/${id}`;
    const title = data ? eventText(data.event, lang).title : 'Doreham';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast(lang === 'ko' ? '링크를 복사했어요' : 'Link copied');
    } catch {
      /* share sheet closed */
    }
  }

  const ko = lang === 'ko';

  if (loading || !user || (!data && !loadError)) {
    return (
      <>
        <AppHeader lang={lang} setLang={setLang} />
        <main className="app-page">
          <div style={{ height: 320, borderRadius: 22, background: 'var(--paper-2)' }} />
        </main>
      </>
    );
  }

  if (loadError || !data) {
    return (
      <>
        <AppHeader lang={lang} setLang={setLang} />
        <main className="app-page narrow" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🫥</div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 22 }}>{eventError(loadError, lang)}</h1>
          <a href="/events" style={{ color: 'var(--persimmon)', fontWeight: 700 }}>
            ← {ko ? '이벤트 목록' : 'All events'}
          </a>
        </main>
        <AppTabBar lang={lang} />
      </>
    );
  }

  const { event: e, viewer, attendees, comments } = data;
  const t = eventText(e, lang, showOriginal);
  const cat = eventCategory(e.category);
  const started = new Date(e.starts_at).getTime() < loadedAt;
  const open = e.status === 'published' && !started;
  const mapQuery = e.address || e.place_name;
  const openReports = (data.reports ?? []).filter((r) => !r.resolved_at);

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />

      <main className="app-page evd-page">
        <a className="evd-back" href="/events">
          ← {ko ? '이벤트' : 'Events'}
        </a>

        {isNew && e.status === 'published' && (
          <div className="evd-banner good">
            🎉 {ko ? '이벤트가 올라갔어요! 친구에게 공유해 보세요.' : 'Your event is live! Share it with friends.'}
            <button onClick={share}>{ko ? '공유' : 'Share'}</button>
          </div>
        )}
        {posterFailed && <div className="evd-banner bad">🖼️ {eventError('poster_failed', lang)}</div>}
        {e.status === 'cancelled' && <div className="evd-banner bad">❌ {ko ? '취소된 이벤트예요.' : 'This event was cancelled.'}</div>}
        {e.status === 'hidden' && (
          <div className="evd-banner bad">
            🙈{' '}
            {e.hidden_reason === 'reports'
              ? ko ? '여러 명이 신고해서 검토할 때까지 숨겨졌어요. 주최자와 관리자만 볼 수 있어요.' : 'Hidden after several reports, until we review it. Only you and admins can see it.'
              : ko ? '관리자가 숨긴 이벤트예요.' : 'An admin hid this event.'}
          </div>
        )}
        {started && e.status === 'published' && <div className="evd-banner">⏱️ {ko ? '이미 시작했거나 끝난 이벤트예요.' : 'This event has started or already happened.'}</div>}

        <div className={`evd-layout ${e.poster_url ? 'has-poster' : ''}`}>
        {e.poster_url && (
          <a className="evd-poster" href={e.poster_url} target="_blank" rel="noopener noreferrer" aria-label={ko ? '포스터 크게 보기' : 'Open the poster'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="evd-poster-bg" src={e.poster_url} alt="" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="evd-poster-img" src={e.poster_url} alt={ko ? `${t.title} 포스터` : `Poster for ${t.title}`} />
          </a>
        )}

        <article className="evd-card">
          <div className="evd-tags">
            <span className="tag">
              {cat.emoji} {ko ? cat.label_ko : cat.label_en}
            </span>
            <span className="tag">📍 {cityName(e.city, lang)}</span>
            {e.is_featured && <span className="tag feat">⭐ {ko ? '추천' : 'Featured'}</span>}
          </div>

          <h1>{t.title}</h1>

          {t.canToggle && (
            <button className="evd-tr" onClick={() => setShowOriginal((v) => !v)}>
              {showOriginal
                ? ko ? '🌐 번역 보기' : '🌐 Show translation'
                : ko ? `🌐 ${t.sourceLangName}에서 자동 번역됨 · 원문 보기` : `🌐 Translated from ${t.sourceLangName} · Show original`}
            </button>
          )}

          <ul className="evd-info">
            <li>
              <span className="ic">📅</span>
              <div>
                <strong>{dayLabel(e.starts_at, lang)}</strong> · {timeRange(e.starts_at, e.ends_at, lang)}
                <div className="sub">{ko ? '한국 시간' : 'Korea time'}</div>
              </div>
            </li>
            <li>
              <span className="ic">📍</span>
              <div>
                <strong>{t.place}</strong>
                {e.address && <div className="sub">{e.address}</div>}
                <a className="evd-map" href={`https://map.kakao.com/link/search/${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer">
                  {ko ? '카카오맵에서 보기 ↗' : 'Open in Kakao Map ↗'}
                </a>
              </div>
            </li>
            <li>
              <span className="ic">👥</span>
              <div>
                <strong>
                  {e.going_count}
                  {e.capacity ? ` / ${e.capacity}` : ''} {ko ? '명 참여' : 'going'}
                </strong>
                {e.is_full && <span className="full">{ko ? '마감' : 'Full'}</span>}
              </div>
            </li>
            {e.fee_text && (
              <li>
                <span className="ic">💸</span>
                <div>
                  <strong>{e.fee_text}</strong>
                </div>
              </li>
            )}
          </ul>

          <HostRow host={e.host} lang={lang} />

          <div className="evd-actions">
            {viewer.is_host ? (
              <span className="evd-you">{ko ? '내가 주최하는 이벤트예요' : "You're hosting"}</span>
            ) : viewer.going ? (
              <>
                <span className="evd-you going">✓ {ko ? '참여해요' : "You're going"}</span>
                {open && (
                  <button className="btn ghost" disabled={busy === 'going'} onClick={() => setGoing(false)}>
                    {ko ? '참여 취소' : "Can't make it"}
                  </button>
                )}
              </>
            ) : open ? (
              <button className="btn primary" disabled={busy === 'going' || e.is_full} onClick={() => setGoing(true)}>
                {e.is_full ? (ko ? '마감됐어요' : 'Full') : busy === 'going' ? '…' : ko ? '🙋 참여할게요' : "🙋 I'm going"}
              </button>
            ) : null}
            <button className="btn ghost" onClick={share}>
              {ko ? '공유' : 'Share'}
            </button>
            {viewer.can_edit && (
              <>
                <a className="btn ghost" href={`/events/${id}/edit`}>
                  {ko ? '수정' : 'Edit'}
                </a>
                {e.status !== 'cancelled' && !confirmCancel && (
                  <button className="btn ghost danger" onClick={() => setConfirmCancel(true)}>
                    {ko ? '이벤트 취소' : 'Cancel event'}
                  </button>
                )}
              </>
            )}
          </div>

          {confirmCancel && (
            <div className="evd-confirm">
              <p>{ko ? '이 이벤트를 취소할까요? 참여자 모두에게 알림이 가요.' : 'Cancel this event? Everyone going gets a notification.'}</p>
              <button className="btn danger-solid" disabled={busy === 'cancel'} onClick={cancelEvent}>
                {ko ? '네, 취소할게요' : 'Yes, cancel it'}
              </button>
              <button className="btn ghost" onClick={() => setConfirmCancel(false)}>
                {ko ? '유지' : 'Keep it'}
              </button>
            </div>
          )}

          {actionError && (
            <p className="evd-error" role="alert">
              {actionError}
              {needsProfile && (
                <>
                  {' '}
                  <a href="/onboarding">{ko ? '프로필 만들기 →' : 'Make my profile →'}</a>
                </>
              )}
            </p>
          )}
        </article>

        <div className="evd-main">

        <div className="evd-sec">
          <h2>{ko ? '소개' : 'About'}</h2>
          <p className="evd-desc">{t.description}</p>
        </div>

        <div className="evd-sec">
          <h2>
            {ko ? '참여자' : "Who's going"} <span className="cnt">{e.going_count}</span>
          </h2>
          {attendees.length > 0 ? (
            <div className="evd-people">
              {attendees.map((p) => (
                <Person key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <p className="muted">{ko ? '참여하면 누가 오는지 볼 수 있어요.' : "Join to see who's going."}</p>
          )}
        </div>

        <div className="evd-sec">
          <h2>
            {ko ? '댓글' : 'Comments'} <span className="cnt">{comments.length}</span>
          </h2>
          {comments.length === 0 && <p className="muted">{ko ? '궁금한 점을 물어보세요.' : 'Ask the host a question.'}</p>}
          <ul className="evd-comments">
            {comments.map((c) => (
              <li key={c.id}>
                <a href={`/profile/${c.author.id}`} className="c-av">
                  {c.author.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.author.photo_url} alt="" />
                  ) : (
                    <span>{initials(c.author.display_name)}</span>
                  )}
                </a>
                <div className="c-body">
                  <div className="c-head">
                    <strong>{c.author.display_name || (ko ? '회원' : 'Member')}</strong>
                    <span className="c-time">{relativeTime(c.created_at, lang)}</span>
                  </div>
                  <p>{c.body}</p>
                  <div className="c-acts">
                    {c.can_delete && (
                      <button disabled={busy === `del-${c.id}`} onClick={() => deleteComment(c.id)}>
                        {ko ? '삭제' : 'Delete'}
                      </button>
                    )}
                    {c.author.id !== user.id && <button onClick={() => setReport({ commentId: c.id })}>{ko ? '신고' : 'Report'}</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {e.status !== 'cancelled' && e.status !== 'hidden' && (
            <form className="evd-cform" onSubmit={postComment}>
              <textarea
                value={comment}
                maxLength={500}
                rows={2}
                onChange={(ev) => setComment(ev.target.value)}
                placeholder={ko ? '댓글 남기기…' : 'Write a comment…'}
              />
              <button className="btn primary" type="submit" disabled={busy === 'comment' || !comment.trim()}>
                {ko ? '등록' : 'Post'}
              </button>
            </form>
          )}
        </div>

        <aside className="evd-safety">
          <strong>{ko ? '안전하게 만나요' : 'Meet safely'}</strong>
          <p>
            {ko
              ? '공개된 장소에서 만나고, 미리 돈을 보내지 마세요. 불편한 일이 있으면 신고해 주세요. 도레함은 이벤트 참여에 돈을 받지 않아요.'
              : "Meet in public places and never send money in advance. If something feels wrong, report it. Doreham never charges to join an event."}
          </p>
          {!viewer.is_host && (
            <button className="linkish" onClick={() => setReport({ commentId: null })}>
              {ko ? '이 이벤트 신고하기' : 'Report this event'}
            </button>
          )}
        </aside>

        {viewer.is_admin && (
          <div className="evd-admin">
            <h2>Admin</h2>
            <div className="evd-actions">
              {e.is_featured ? (
                <button className="btn ghost" disabled={!!busy} onClick={() => moderate('unfeature')}>Unfeature</button>
              ) : (
                <button className="btn ghost" disabled={!!busy} onClick={() => moderate('feature')}>⭐ Feature</button>
              )}
              {e.status === 'hidden' ? (
                <button className="btn ghost" disabled={!!busy} onClick={() => moderate('restore')}>Restore (publish)</button>
              ) : e.status === 'published' ? (
                <button className="btn ghost danger" disabled={!!busy} onClick={() => moderate('hide')}>Hide</button>
              ) : null}
              {openReports.length > 0 && e.status !== 'hidden' && (
                <button className="btn ghost" disabled={!!busy} onClick={() => moderate('restore')}>Dismiss reports</button>
              )}
            </div>
            {(data.reports ?? []).length > 0 && (
              <ul className="evd-reports">
                {(data.reports ?? []).map((r) => (
                  <li key={r.id} className={r.resolved_at ? 'done' : ''}>
                    <strong>{r.reason}</strong> {r.comment_id ? '(comment)' : '(event)'} · {relativeTime(r.created_at, 'en')}
                    {r.details && <div className="muted">{r.details}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        </div>
        </div>
      </main>

      {report && (
        <ReportSheet
          lang={lang}
          onClose={() => {
            setReport(null);
            setActionError('');
          }}
          onSend={async (reason, details) => {
            const ok = await call('report', `/api/events/${id}/report`, {
              method: 'POST',
              body: JSON.stringify({ reason, details, comment_id: report.commentId }),
            });
            if (ok) {
              setReport(null);
              setToast(ko ? '신고해 주셔서 고마워요. 확인할게요.' : "Thanks for telling us. We'll take a look.");
            }
          }}
          busy={busy === 'report'}
          error={actionError}
        />
      )}

      {toast && <div className="evd-toast" role="status">{toast}</div>}

      <AppTabBar lang={lang} />

      <style jsx>{`
        .evd-layout { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: 'info' 'main'; gap: 18px; }
        .evd-layout.has-poster { grid-template-areas: 'poster' 'info' 'main'; }
        .evd-poster { grid-area: poster; position: relative; display: block; border-radius: 22px; overflow: hidden; background: var(--paper-2); border: 1px solid var(--ink-12); isolation: isolate; }
        .evd-poster-bg { position: absolute; inset: -40px; width: calc(100% + 80px); height: calc(100% + 80px); object-fit: cover; filter: blur(28px) saturate(1.1); opacity: 0.55; z-index: -1; }
        .evd-poster-img { position: relative; display: block; width: 100%; max-height: 72vh; object-fit: contain; }
        .evd-card { grid-area: info; }
        .evd-main { grid-area: main; min-width: 0; }
        .evd-main > :first-child { margin-top: 4px; }
        @media (min-width: 900px) {
          .evd-layout { grid-template-columns: minmax(0, 1fr) 380px; grid-template-areas: 'main info'; column-gap: 32px; row-gap: 24px; align-items: start; }
          .evd-layout.has-poster { grid-template-areas: 'poster info' 'main info'; }
          .evd-card { position: sticky; top: 88px; }
          .evd-poster-img { max-height: 640px; }
        }
        .evd-back { display: inline-block; color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; margin-bottom: 12px; }
        .evd-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 14px; padding: 11px 14px; font-size: 14px; margin-bottom: 12px; }
        .evd-banner.good { background: rgba(15, 157, 119, 0.08); border-color: rgba(15, 157, 119, 0.3); }
        .evd-banner.bad { background: #fef3f2; border-color: #fecdca; color: #912018; }
        .evd-banner button { margin-left: auto; background: var(--jade); color: #fff; border: 0; border-radius: 999px; padding: 6px 14px; font-weight: 700; cursor: pointer; font-family: var(--body); }

        .evd-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 22px; padding: 20px; }
        .evd-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .tag { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--paper-2); color: var(--ink-60); }
        .tag.feat { background: rgba(255, 106, 61, 0.12); color: var(--persimmon); }
        h1 { font-family: var(--display); font-weight: 800; font-size: 26px; line-height: 1.25; letter-spacing: -0.015em; margin: 0 0 6px; word-break: keep-all; overflow-wrap: anywhere; }
        .evd-tr { background: none; border: 0; padding: 0; color: var(--ink-60); font-size: 12.5px; font-family: var(--body); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; margin-bottom: 6px; }
        .evd-info { list-style: none; padding: 0; margin: 14px 0; display: flex; flex-direction: column; gap: 12px; }
        .evd-info li { display: flex; gap: 12px; font-size: 15px; }
        .evd-info .ic { width: 22px; text-align: center; flex-shrink: 0; }
        .evd-info .sub { color: var(--ink-60); font-size: 13px; margin-top: 1px; }
        .evd-map { display: inline-block; margin-top: 4px; font-size: 13px; font-weight: 700; color: var(--persimmon); text-decoration: none; }
        .full { margin-left: 8px; font-size: 12px; font-weight: 800; color: #b42318; background: #fef3f2; padding: 2px 8px; border-radius: 999px; }

        .evd-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 16px; }
        .evd-you { font-weight: 800; font-size: 14.5px; color: var(--persimmon); margin-right: 4px; }
        .evd-you.going { color: var(--jade); }
        .btn { font-family: var(--body); font-weight: 700; font-size: 14px; line-height: 1.2; border-radius: 999px; padding: 10px 18px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; border: 1px solid transparent; }
        .btn.primary { background: var(--persimmon); color: #fff; font-size: 15px; padding: 11px 22px; }
        .btn:hover { transform: none; }
        .btn.ghost { background: #fff; border-color: var(--ink-12); color: var(--ink); }
        .btn.ghost.danger { color: #b42318; }
        .btn.danger-solid { background: #d92d20; color: #fff; }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .evd-confirm { margin-top: 12px; background: #fef3f2; border-radius: 14px; padding: 12px 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .evd-confirm p { margin: 0; flex-basis: 100%; font-size: 14px; color: var(--ink); }
        .evd-error { color: #b42318; background: #fef3f2; border-radius: 12px; padding: 10px 14px; font-size: 14px; margin: 12px 0 0; }

        .evd-sec { margin-top: 26px; }
        .evd-sec h2, .evd-admin h2 { font-family: var(--display); font-weight: 800; font-size: 18px; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
        .cnt { font-size: 13px; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 999px; padding: 1px 9px; color: var(--ink-60); }
        .evd-desc { white-space: pre-wrap; line-height: 1.65; font-size: 15px; margin: 0; overflow-wrap: anywhere; color: var(--ink); }
        .muted { color: var(--ink-60); font-size: 14px; margin: 0; }
        .evd-people { display: flex; flex-wrap: wrap; gap: 12px; }

        .evd-comments { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 14px; }
        .evd-comments li { display: flex; gap: 10px; }
        .c-av { flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: var(--lav); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: var(--ink); text-decoration: none; }
        .c-av img { width: 100%; height: 100%; object-fit: cover; }
        .c-body { flex: 1; min-width: 0; }
        .c-head { display: flex; gap: 8px; align-items: baseline; font-size: 14px; }
        .c-time { color: var(--ink-60); font-size: 12px; }
        .c-body p { color: var(--ink); margin: 2px 0 0; font-size: 14.5px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
        .c-acts { display: flex; gap: 10px; margin-top: 2px; }
        .c-acts button { background: none; border: 0; padding: 0; font-size: 12px; color: var(--ink-60); cursor: pointer; font-family: var(--body); }
        .evd-cform { display: flex; gap: 8px; align-items: flex-end; }
        .evd-cform textarea { flex: 1; font-family: var(--body); font-size: 15px; border: 1px solid var(--ink-12); border-radius: 14px; padding: 10px 12px; resize: vertical; min-height: 44px; }

        .evd-safety { margin-top: 28px; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 16px; padding: 14px 16px; font-size: 13.5px; }
        .evd-safety p { margin: 4px 0 8px; color: var(--ink-60); line-height: 1.55; }
        .linkish { background: none; border: 0; padding: 0; color: #b42318; font-weight: 700; font-size: 13px; cursor: pointer; font-family: var(--body); }

        .evd-admin { margin-top: 24px; border: 2px dashed rgba(15, 157, 119, 0.4); border-radius: 16px; padding: 14px 16px; }
        .evd-admin .evd-actions { margin-top: 0; }
        .evd-reports { margin: 12px 0 0; padding-left: 18px; font-size: 13.5px; display: flex; flex-direction: column; gap: 6px; }
        .evd-reports li.done { opacity: 0.5; }

        .evd-toast { position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%); background: var(--ink); color: var(--paper); padding: 10px 18px; border-radius: 999px; font-size: 14px; font-weight: 600; z-index: 70; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
        @media (max-width: 560px) {
          .evd-card { padding: 16px; border-radius: 18px; }
          h1 { font-size: 22px; }
        }
      `}</style>
    </>
  );
}

function HostRow({ host, lang }: { host: EventDetail['event']['host']; lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  const href = host.kind === 'user' && host.profile_id ? `/profile/${host.profile_id}` : host.kind === 'venue' && host.venue_id ? `/venues/${host.venue_id}` : null;
  const label = host.kind === 'venue' ? (ko ? '가게에서 주최' : 'Hosted by a venue') : host.kind === 'admin' ? (ko ? '도레함 공식 이벤트' : 'Official Doreham event') : ko ? '주최자' : 'Host';
  const inner = (
    <>
      <span className={`h-av ${host.kind}`}>
        {host.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={host.photo_url} alt="" />
        ) : host.kind === 'admin' ? (
          'D'
        ) : (
          initials(host.name)
        )}
      </span>
      <span>
        <span className="h-label">{label}</span>
        <span className="h-name">
          {host.name}
          {!!host.level && host.level >= 2 && (
            <span className="h-lv">
              {' '}
              {levelByNumber(host.level).emoji} {ko ? levelByNumber(host.level).ko : levelByNumber(host.level).en}
            </span>
          )}
        </span>
      </span>
      <style jsx>{`
        .h-av { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: var(--lav); font-weight: 800; font-size: 14px; flex-shrink: 0; }
        .h-av.venue { background: var(--pink); border-radius: 12px; }
        .h-av.admin { background: var(--persimmon); color: #fff; }
        .h-av img { width: 100%; height: 100%; object-fit: cover; }
        .h-label { display: block; font-size: 12px; color: var(--ink-60); font-weight: 600; }
        .h-name { display: block; font-weight: 800; font-size: 15px; }
        .h-lv { font-weight: 600; font-size: 12.5px; color: var(--ink-60); }
      `}</style>
    </>
  );
  return href ? (
    <a href={href} className="host-row">
      {inner}
      <style jsx>{`
        .host-row { display: flex; align-items: center; gap: 10px; padding: 12px 0 0; border-top: 1px solid var(--ink-12); text-decoration: none; color: var(--ink); }
      `}</style>
    </a>
  ) : (
    <div className="host-row">
      {inner}
      <style jsx>{`
        .host-row { display: flex; align-items: center; gap: 10px; padding: 12px 0 0; border-top: 1px solid var(--ink-12); color: var(--ink); }
      `}</style>
    </div>
  );
}

function Person({ p }: { p: EventPerson }) {
  return (
    <a href={`/profile/${p.id}`} className="person" title={p.display_name}>
      <span className="p-av">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo_url} alt="" />
        ) : (
          initials(p.display_name)
        )}
      </span>
      <span className="p-name">{p.display_name}</span>
      <style jsx>{`
        .person { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 64px; text-decoration: none; color: var(--ink); }
        .p-av { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: var(--lav); display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .p-av img { width: 100%; height: 100%; object-fit: cover; }
        .p-name { font-size: 12px; font-weight: 600; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </a>
  );
}

function ReportSheet({
  lang,
  onClose,
  onSend,
  busy,
  error,
}: {
  lang: 'en' | 'ko';
  onClose: () => void;
  onSend: (reason: string, details: string) => void;
  busy: boolean;
  error: string;
}) {
  const ko = lang === 'ko';
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  return (
    <div className="rs-back" onClick={onClose} role="presentation">
      <div className="rs" role="dialog" aria-modal="true" aria-label={ko ? '신고' : 'Report'} onClick={(e) => e.stopPropagation()}>
        <h3>{ko ? '무엇이 문제인가요?' : "What's wrong?"}</h3>
        <div className="rs-opts">
          {EVENT_REPORT_REASONS.map((r) => (
            <label key={r.slug} className={reason === r.slug ? 'on' : ''}>
              <input type="radio" name="reason" value={r.slug} checked={reason === r.slug} onChange={() => setReason(r.slug)} />
              {ko ? r.label_ko : r.label_en}
            </label>
          ))}
        </div>
        <textarea
          rows={3}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={ko ? '자세한 내용 (선택)' : 'More details (optional)'}
        />
        <p className="rs-note">{ko ? '신고한 사람은 공개되지 않아요.' : "The host won't see who reported."}</p>
        {error && <p className="rs-err" role="alert">{error}</p>}
        <div className="rs-acts">
          <button className="rs-ghost" onClick={onClose}>
            {ko ? '닫기' : 'Close'}
          </button>
          <button className="rs-send" disabled={!reason || busy} onClick={() => onSend(reason, details)}>
            {ko ? '신고하기' : 'Send report'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .rs-back { position: fixed; inset: 0; background: rgba(30, 34, 48, 0.45); z-index: 80; display: flex; align-items: flex-end; justify-content: center; }
        .rs { background: #fff; width: 100%; max-width: 520px; border-radius: 22px 22px 0 0; padding: 20px 20px calc(20px + env(safe-area-inset-bottom)); max-height: 90vh; overflow-y: auto; }
        @media (min-width: 600px) { .rs-back { align-items: center; } .rs { border-radius: 22px; } }
        h3 { font-family: var(--display); font-weight: 800; font-size: 19px; margin: 0 0 12px; }
        .rs-opts { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .rs-opts label { display: flex; gap: 10px; align-items: center; border: 1px solid var(--ink-12); border-radius: 12px; padding: 11px 12px; font-size: 14.5px; cursor: pointer; }
        .rs-opts label.on { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.06); }
        textarea { width: 100%; box-sizing: border-box; font-family: var(--body); font-size: 14.5px; border: 1px solid var(--ink-12); border-radius: 12px; padding: 10px 12px; }
        .rs-note { font-size: 12.5px; color: var(--ink-60); margin: 8px 0 14px; }
        .rs-err { color: #b42318; background: #fef3f2; border-radius: 10px; padding: 8px 12px; font-size: 13.5px; margin: 0 0 12px; }
        .rs-acts { display: flex; justify-content: flex-end; gap: 8px; }
        .rs-ghost, .rs-send { font-family: var(--body); font-weight: 700; font-size: 14px; border-radius: 999px; padding: 10px 18px; cursor: pointer; }
        .rs-ghost { background: #fff; border: 1px solid var(--ink-12); }
        .rs-send { background: #d92d20; color: #fff; border: 0; }
        .rs-send:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
