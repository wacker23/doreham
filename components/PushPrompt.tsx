'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { enablePush, getPushState, sendTestPush, syncPush, type PushState } from '@/lib/push';

const DISMISS_KEY = 'doreham_push_prompt_dismissed_at';
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Soft ask under the app header: explains why, and only then triggers the browser's
 * permission dialog (from a tap, as Safari requires). On iPhone it explains Add to Home Screen.
 * Hidden once notifications are on, blocked, unsupported, or dismissed (for 14 days).
 */
export function PushPrompt({ lang }: { lang: 'en' | 'ko' }) {
  const { user } = useUser();
  const [state, setState] = useState<PushState>('loading');
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPushState().then((s) => {
      if (cancelled) return;
      setState(s);
      setHidden(dismissedRecently());
      if (s === 'on') syncPush(lang);
    });
    return () => {
      cancelled = true;
    };
    // lang is only sent along on sync; re-running on language change re-syncs the language too
  }, [user, lang]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setHidden(true);
  }

  async function turnOn() {
    setBusy(true);
    setNote(null);
    try {
      const s = await enablePush(lang);
      setState(s);
      if (s === 'on') {
        setNote(t('Notifications are on. We just sent you a test.', '알림이 켜졌어요. 테스트 알림을 보냈어요.'));
        sendTestPush();
        setTimeout(() => setHidden(true), 5000);
      } else if (s === 'denied') {
        setNote(t('Notifications are blocked. You can allow them in your browser settings.', '알림이 차단되어 있어요. 브라우저 설정에서 허용할 수 있어요.'));
      }
    } catch {
      setNote(t('Something went wrong. Please try again.', '문제가 생겼어요. 다시 시도해 주세요.'));
    }
    setBusy(false);
  }

  const askable = state === 'default' || state === 'off' || state === 'ios-install';
  if (!user || hidden || (!askable && !note)) return null;

  return (
    <div className="pp-wrap" role="region" aria-label={t('Notifications', '알림')}>
      <div className="pp-card">
        <div className="pp-ic" aria-hidden="true">🔔</div>
        <div className="pp-text">
          {note ? (
            <div className="pp-title">{note}</div>
          ) : state === 'ios-install' ? (
            <>
              <div className="pp-title">{t('Get notifications on your iPhone', '아이폰에서 알림 받기')}</div>
              <div className="pp-sub">
                {t(
                  'Tap the Share button (square with an arrow), choose "Add to Home Screen", then open Doreham from your Home Screen and turn notifications on.',
                  '공유 버튼(화살표가 있는 네모)을 누르고 "홈 화면에 추가"를 선택한 뒤, 홈 화면의 도레함에서 알림을 켜 주세요.',
                )}
              </div>
            </>
          ) : (
            <>
              <div className="pp-title">{t("Don't miss your group", '그룹 소식을 놓치지 마세요')}</div>
              <div className="pp-sub">
                {t(
                  'Turn on notifications for group invites, quest reminders and event updates.',
                  '그룹 초대, 퀘스트 알림, 이벤트 소식을 받으려면 알림을 켜 주세요.',
                )}
              </div>
            </>
          )}
        </div>
        <div className="pp-actions">
          {!note && state !== 'ios-install' && (
            <button className="pp-on" onClick={turnOn} disabled={busy}>
              {busy ? '…' : t('Turn on', '알림 켜기')}
            </button>
          )}
          <button className="pp-later" onClick={dismiss}>
            {note ? t('Close', '닫기') : t('Not now', '나중에')}
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
        .pp-later { border: 1px solid var(--ink-12); background: #fff; color: var(--ink-60); font-weight: 600; font-size: 13px; border-radius: 999px; padding: 8px 14px; cursor: pointer; white-space: nowrap; font-family: var(--body); }
        @media (min-width: 600px) { .pp-wrap { padding: 0 24px; } }
        @media (max-width: 520px) {
          .pp-card { flex-wrap: wrap; }
          .pp-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
