'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { EventForm } from '@/components/EventForm';

export default function NewEventPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in?return=/events/new');
  }, [loading, user, router]);

  if (loading || !user) return null;
  const ko = lang === 'ko';

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />
      <main className="wrap evn-wrap">
        <a className="evn-back" href="/events">← {ko ? '이벤트' : 'Events'}</a>
        <h1>{ko ? '이벤트 열기' : 'Host an event'}</h1>
        <p className="evn-sub">
          {ko
            ? '커피 한 잔, 산책, 보드게임, 언어 교환. 작은 모임도 좋아요. 올리면 같은 도시 사람들이 볼 수 있어요.'
            : 'Coffee, a walk, board games, a language exchange. Small is fine. People in your city will see it.'}
        </p>
        <EventForm lang={lang} />
      </main>
      <style jsx>{`
        .evn-wrap { max-width: 680px; padding-top: 20px; padding-bottom: 60px; }
        .evn-back { display: inline-block; color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 6px; }
        .evn-sub { color: var(--ink-60); font-size: 14.5px; margin: 0 0 22px; }
      `}</style>
    </>
  );
}
