'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { autoPush, iosHintSeen, markIosHintSeen } from '@/lib/push';

/**
 * Notifications, the app way: on the first app page after sign-in the browser's own
 * permission dialog appears once (see autoPush). Nothing else is shown, except on an
 * iPhone/iPad browser tab, where notifications only work after Add to Home Screen:
 * there a one-time hint explains that.
 */
export function PushPrompt({ lang }: { lang: 'en' | 'ko' }) {
  const { user } = useUser();
  const userId = user?.id;
  const [iosHint, setIosHint] = useState(false);
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    autoPush(lang).then((state) => {
      if (!cancelled && state === 'ios-install' && !iosHintSeen()) setIosHint(true);
    });
    return () => {
      cancelled = true;
    };
    // re-running on a language change only re-syncs the language of this device
  }, [userId, lang]);

  if (!user || !iosHint) return null;

  function close() {
    markIosHintSeen();
    setIosHint(false);
  }

  return (
    <div className="pp-wrap" role="region" aria-label={t('Notifications', '알림')}>
      <div className="pp-card">
        <div className="pp-ic" aria-hidden="true">🔔</div>
        <div className="pp-text">
          <div className="pp-title">{t('Get notifications on your iPhone', '아이폰에서 알림 받기')}</div>
          <div className="pp-sub">
            {t(
              'Tap the Share button (square with an arrow), choose "Add to Home Screen", then open Doreham from your Home Screen.',
              '공유 버튼(화살표가 있는 네모)을 누르고 "홈 화면에 추가"를 선택한 뒤, 홈 화면의 도레함에서 열어 주세요.',
            )}
          </div>
        </div>
        <button className="pp-later" onClick={close}>{t('OK', '확인')}</button>
      </div>
      <style jsx>{`
        .pp-wrap { position: relative; z-index: 1; max-width: 1160px; margin: 12px auto 0; padding: 0 16px; }
        .pp-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; padding: 14px 16px; box-shadow: 0 6px 20px rgba(30, 34, 48, 0.06); }
        .pp-ic { width: 40px; height: 40px; flex: none; border-radius: 12px; background: rgba(255, 106, 61, 0.1); display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .pp-text { flex: 1; min-width: 0; }
        .pp-title { font-weight: 800; font-size: 14.5px; color: var(--ink); }
        .pp-sub { font-size: 13px; color: var(--ink-60); margin-top: 2px; line-height: 1.45; }
        .pp-later { flex: none; border: 1px solid var(--ink-12); background: #fff; color: var(--ink); font-weight: 700; font-size: 13px; border-radius: 999px; padding: 8px 16px; cursor: pointer; white-space: nowrap; font-family: var(--body); }
        @media (min-width: 600px) { .pp-wrap { padding: 0 24px; } }
      `}</style>
    </div>
  );
}
