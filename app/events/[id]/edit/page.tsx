'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { EventForm, type EditableEvent } from '@/components/EventForm';
import { eventError } from '@/lib/eventDisplay';

export default function EditEventPage() {
  const id = String(useParams()?.id ?? '');
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const [event, setEvent] = useState<EditableEvent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/sign-in?return=/events/${id}/edit`);
  }, [loading, user, router, id]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/events/${id}/edit`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'not_found');
        if (j.event.status === 'cancelled') throw new Error('event_cancelled');
        setEvent(j.event);
      })
      .catch((e: Error) => setError(e.message));
  }, [user, id]);

  if (loading || !user) return null;
  const ko = lang === 'ko';

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />
      <main className="app-page narrow evn-wrap">
        <a className="evn-back" href={`/events/${id}`}>← {ko ? '이벤트로 돌아가기' : 'Back to event'}</a>
        <h1>{ko ? '이벤트 수정' : 'Edit event'}</h1>
        <p className="evn-sub">
          {ko ? '날짜, 시간이나 장소를 바꾸면 참여자에게 알림이 가요.' : "If you change the date, time or place, everyone going gets a notification."}
        </p>
        {error ? <p className="evn-error">{eventError(error, lang)}</p> : event ? <EventForm lang={lang} initial={event} /> : <div className="evn-loading" />}
      </main>
      <style jsx>{`
        .evn-wrap { max-width: 720px; }
        .evn-back { display: inline-block; color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 6px; line-height: 1.15; }
        .evn-sub { color: var(--ink-60); font-size: 14.5px; margin: 0 0 22px; }
        .evn-error { color: #b42318; background: #fef3f2; border-radius: 12px; padding: 12px 14px; }
        .evn-loading { height: 300px; border-radius: 18px; background: var(--paper-2); }
      `}</style>
    </>
  );
}
