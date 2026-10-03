'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { cityName } from '@/lib/cities';
import { eventCategory } from '@/lib/eventCategories';
import { dayLabel, relativeTime, timeRange } from '@/lib/eventDisplay';
import type { EventBase, EventReport, FeedEvent } from '@/lib/eventTypes';
import { Icon } from '@/components/icons/Icon';
import { CategoryIcon } from '@/components/icons/CategoryIcon';

type QueueEvent = EventBase & { hidden_reason: string | null };
type QueueComment = { id: string; body: string; user_id: string; deleted_at: string | null };
type Queue = { events: QueueEvent[]; reports: (EventReport & { event_id: string })[]; comments: QueueComment[] };

/** Admin: review reported/hidden events and comments, and pick featured events. English only, like the other admin pages. */
export default function AdminEventsPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [upcoming, setUpcoming] = useState<FeedEvent[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [q, u] = await Promise.all([fetch('/api/admin/events'), fetch('/api/events?scope=upcoming')]);
    const qj = await q.json().catch(() => ({}));
    if (!q.ok) {
      if (q.status === 403) router.push('/');
      setError(qj.error || 'load_failed');
      return;
    }
    setQueue(qj as Queue);
    const uj = await u.json().catch(() => ({}));
    setUpcoming(uj.events ?? []);
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/admin/events');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [user, loading, router, load]);

  async function act(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setError('');
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || 'failed');
    await load();
    setBusy('');
  }
  const moderate = (id: string, action: 'feature' | 'unfeature' | 'hide' | 'restore') =>
    act(`${action}-${id}`, `/api/events/${id}`, { method: 'PATCH', body: JSON.stringify({ moderate: action }) });
  const deleteComment = (eventId: string, commentId: string) =>
    act(`del-${commentId}`, `/api/events/${eventId}/comments?comment_id=${commentId}`, { method: 'DELETE' });

  if (loading || !user) return null;

  const reportsFor = (eventId: string) => (queue?.reports ?? []).filter((r) => r.event_id === eventId);
  const commentById = new Map((queue?.comments ?? []).map((c) => [c.id, c]));

  return (
    <>
      <header className="a-nav">
        <div className="wrap a-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span> · Events
          </a>
          <nav className="a-links">
            <a href="/admin/matches">Matches</a>
            <a href="/admin/venues">Venues</a>
            <a href="/events">Feed</a>
          </nav>
        </div>
      </header>

      <main className="wrap a-wrap">
        <h1>Events moderation</h1>
        <p className="muted">
          Events reported by 3 different people are hidden automatically; comments with 3 reports are removed. Restore keeps an event (and dismisses its reports); Hide removes it from the feed.
        </p>
        {error && <div className="err">{error}</div>}

        <h2>Needs a look ({queue?.events.length ?? '…'})</h2>
        {queue && queue.events.length === 0 && <p className="muted">Nothing reported.</p>}
        <div className="list">
          {queue?.events.map((e) => {
            const reps = reportsFor(e.id);
            const cat = eventCategory(e.category);
            return (
              <div key={e.id} className={`q-card ${e.status}`}>
                <div className="top">
                  <span className={`st ${e.status}`}>{e.status}{e.hidden_reason ? ` · ${e.hidden_reason}` : ''}</span>
                  <span className="muted small">
                    <CategoryIcon art={cat.art} size={16} /> {cat.label_en} · {cityName(e.city, 'en')} · {dayLabel(e.starts_at, 'en')} {timeRange(e.starts_at, e.ends_at, 'en')}
                  </span>
                </div>
                <a className="title" href={`/events/${e.id}`} target="_blank" rel="noreferrer">
                  {e.title} ↗
                </a>
                <p className="desc">{e.description.slice(0, 280)}{e.description.length > 280 ? '…' : ''}</p>
                {reps.length > 0 && (
                  <ul className="reps">
                    {reps.map((r) => {
                      const c = r.comment_id ? commentById.get(r.comment_id) : null;
                      return (
                        <li key={r.id}>
                          <strong>{r.reason}</strong> · {r.comment_id ? 'comment' : 'event'} · {relativeTime(r.created_at, 'en')}
                          {r.details && <div className="muted small">“{r.details}”</div>}
                          {c && (
                            <div className="cmt">
                              {c.deleted_at ? <s>{c.body}</s> : c.body}
                              {!c.deleted_at && (
                                <button disabled={!!busy} onClick={() => deleteComment(e.id, c.id)}>
                                  Delete comment
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="acts">
                  {e.status === 'hidden' ? (
                    <button disabled={!!busy} onClick={() => moderate(e.id, 'restore')}>Restore</button>
                  ) : (
                    <>
                      <button disabled={!!busy} onClick={() => moderate(e.id, 'restore')}>Dismiss reports</button>
                      {e.status === 'published' && (
                        <button className="danger" disabled={!!busy} onClick={() => moderate(e.id, 'hide')}>Hide</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <h2>Upcoming ({upcoming.length})</h2>
        <div className="list">
          {upcoming.map((e) => (
            <div key={e.id} className="row">
              <div>
                <a className="title small" href={`/events/${e.id}`} target="_blank" rel="noreferrer">
                  {e.is_featured ? <Icon name="starFilled" size={14} /> : null}
                  {e.title}
                </a>
                <div className="muted small">
                  {cityName(e.city, 'en')} · {dayLabel(e.starts_at, 'en')} · {e.host.kind}: {e.host.name} · <Icon name="people" size={14} /> {e.going_count}
                </div>
              </div>
              <div className="acts">
                <button disabled={!!busy} onClick={() => moderate(e.id, e.is_featured ? 'unfeature' : 'feature')}>
                  {e.is_featured ? 'Unfeature' : 'Feature'}
                </button>
                <button className="danger" disabled={!!busy} onClick={() => moderate(e.id, 'hide')}>Hide</button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style jsx>{`
        .a-nav { border-bottom: 1px solid var(--ink-12); background: var(--paper-2); }
        .a-nav-in { display: flex; align-items: center; justify-content: space-between; height: 60px; }
        .brand { font-family: var(--display); font-weight: 800; font-size: 18px; text-decoration: none; color: var(--ink); }
        .ko-mark { color: var(--ink-60); font-size: 15px; }
        .a-links { display: flex; gap: 14px; }
        .a-links a { color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; }
        .a-wrap { max-width: 900px; padding-top: 24px; padding-bottom: 60px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 28px; margin: 0 0 6px; }
        h2 { font-family: var(--display); font-weight: 800; font-size: 19px; margin: 28px 0 10px; }
        .muted { color: var(--ink-60); font-size: 14px; }
        p { color: var(--ink); }
        .small { font-size: 12.5px; }
        .err { background: #fef3f2; color: #b42318; padding: 10px 14px; border-radius: 12px; margin: 10px 0; }
        .list { display: flex; flex-direction: column; gap: 10px; }
        .q-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 14px 16px; }
        .q-card.hidden { border-color: #fecdca; }
        .top { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .st { font-size: 11.5px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; background: var(--paper-2); }
        .st.hidden { background: #fef3f2; color: #b42318; }
        .st.published { background: rgba(15, 157, 119, 0.12); color: var(--jade); }
        .title { display: block; font-weight: 800; font-size: 16px; color: var(--ink); text-decoration: none; margin: 6px 0 2px; }
        .title.small { font-size: 14.5px; margin: 0; }
        .desc { font-size: 13.5px; color: var(--ink-60); margin: 4px 0; white-space: pre-wrap; }
        .reps { margin: 8px 0; padding-left: 18px; font-size: 13.5px; display: flex; flex-direction: column; gap: 6px; }
        .cmt { margin-top: 4px; background: var(--paper-2); border-radius: 10px; padding: 6px 10px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
        .acts { display: flex; gap: 8px; flex-wrap: wrap; }
        button { font-family: var(--body); font-weight: 700; font-size: 13px; border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 13px; cursor: pointer; color: var(--ink); }
        button.danger { color: #b42318; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .row { display: flex; justify-content: space-between; gap: 12px; align-items: center; background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; padding: 10px 14px; }
      `}</style>
    </>
  );
}
