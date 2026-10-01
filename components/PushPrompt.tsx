'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { askNow, autoPush, bannerClosedThisVisit, closeBannerThisVisit, type PushState } from '@/lib/push';

/**
 * Notifications, like an app: on every visit (and after signing in) the browser's own
 * permission dialog appears until notifications are allowed (see autoPush). If they're still
 * off afterwards, a small reminder explains how to turn them on; it can be closed for this
 * visit and comes back next time.
 */
export function PushPrompt({ lang }: { lang: 'en' | 'ko' }) {
  const { user } = useUser();
  const userId = user?.id;
  const [state, setState] = useState<PushState>('loading');
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    autoPush(lang, userId).then((s) => {
      if (cancelled) return;
      setState(s);
      setHidden(bannerClosedThisVisit());
    });
    return () => {
      cancelled = true;
    };
    // re-running on a language change only re-syncs the language of this device
  }, [userId, lang]);

  const show = !hidden && (state === 'default' || state === 'denied' || state === 'ios-install');
  if (!userId || !show) return null;

  function close() {
    closeBannerThisVisit();
    setHidden(true);
  }

  async function turnOn() {
    setBusy(true);
    const s = await askNow(lang);
    setState(s);
    setBusy(false);
  }

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  return (
    <div className="pp-wrap" role="region" aria-label={t('Notifications', '알림')}>
      <div className="pp-card">
        <div className="pp-ic" aria-hidden="true">🔔</div>
        <div className="pp-text">
          {state === 'ios-install' ? (
            <>
              <div className="pp-title">{t('Get notifications on your iPhone', '아이폰에서 알림 받기')}</div>
              <div className="pp-sub">
                {t(
                  'Tap the Share button (square with an arrow), choose "Add to Home Screen", then open Doreham from your Home Screen.',
                  '공유 버튼(화살표가 있는 네모)을 누르고 "홈 화면에 추가"를 선택한 뒤, 홈 화면의 도레함에서 열어 주세요.',
                )}
              </div>
            </>
          ) : state === 'denied' ? (
            <>
              <div className="pp-title">{t('Notifications are blocked', '알림이 차단되어 있어요')}</div>
              <div className="pp-sub">
                {isAndroid
                  ? t(
                      'You will miss group invites and messages. Tap the icon left of the address bar → Permissions → Notifications → Allow. (Installed app: hold the Doreham icon → App info → Notifications.)',
                      '그룹 초대와 메시지를 놓칠 수 있어요. 주소창 왼쪽 아이콘 → 권한 → 알림 → 허용을 눌러 주세요. (앱으로 설치했다면: 도레함 아이콘을 길게 누름 → 앱 정보 → 알림)',
                    )
                  : t(
                      'You will miss group invites and messages. Click the icon left of the address bar and allow notifications for doreham.co.kr.',
                      '그룹 초대와 메시지를 놓칠 수 있어요. 주소창 왼쪽 아이콘을 눌러 doreham.co.kr 알림을 허용해 주세요.',
                    )}
              </div>
            </>
          ) : (
            <>
              <div className="pp-title">{t('Turn on notifications', '알림을 켜 주세요')}</div>
              <div className="pp-sub">
                {t('So you never miss a group invite, a message or a quest reminder.', '그룹 초대, 메시지, 퀘스트 알림을 놓치지 않도록요.')}
              </div>
            </>
          )}
        </div>
        <div className="pp-actions">
          {state === 'default' && (
            <button className="pp-on" onClick={turnOn} disabled={busy}>
              {busy ? '…' : t('Turn on', '알림 켜기')}
            </button>
          )}
          <button className="pp-later" onClick={close}>
            {state === 'default' ? t('Later', '나중에') : t('OK', '확인')}
          </button>
        </div>
      </div>
      <style jsx>{`
        .pp-wrap { position: relative; z-index: 1; max-width: 1160px; margin: 12px auto 0; padding: 0 16px; }
        .pp-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; padding: 14px 16px; box-shadow: 0 6px 20px rgba(30, 34, 48, 0.06); }
        .pp-ic { width: 40px; height: 40px; flex: none; border-radius: 12px; background: rgba(255, 106, 61, 0.1); display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .pp-text { flex: 1; min-width: 0; }
        .pp-title { font-weight: 800; font-size: 14.5px; color: var(--ink); }
        .pp-sub { font-size: 13px; color: var(--ink-60); margin-top: 2px; line-height: 1.45; }
        .pp-actions { display: flex; gap: 8px; flex: none; }
        .pp-on { border: 0; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 13.5px; border-radius: 999px; padding: 9px 16px; cursor: pointer; white-space: nowrap; font-family: var(--body); }
        .pp-on:disabled { opacity: 0.6; }
        .pp-later { border: 1px solid var(--ink-12); background: #fff; color: var(--ink); font-weight: 700; font-size: 13px; border-radius: 999px; padding: 8px 14px; cursor: pointer; white-space: nowrap; font-family: var(--body); }
        @media (min-width: 600px) { .pp-wrap { padding: 0 24px; } }
        @media (max-width: 520px) {
          .pp-card { flex-wrap: wrap; }
          .pp-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
