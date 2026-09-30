'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '@/lib/push';

/** Own-profile card: turn push notifications on/off for this device and send a test. */
export function PushSettingsSection({ lang }: { lang: 'en' | 'ko' }) {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  if (state === 'unconfigured') return null;

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const s = await enablePush(lang);
      setState(s);
      if (s === 'denied') setMessage(t('Blocked. Allow notifications for doreham.co.kr in your browser settings.', '차단됨. 브라우저 설정에서 doreham.co.kr 알림을 허용해 주세요.'));
    } catch {
      setMessage(t('Something went wrong. Please try again.', '문제가 생겼어요. 다시 시도해 주세요.'));
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    await disablePush();
    setState(await getPushState());
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const ok = await sendTestPush();
    setMessage(ok ? t('Test sent. It should appear in a few seconds.', '테스트 알림을 보냈어요. 곧 도착할 거예요.') : t("Couldn't send a test. Try turning notifications off and on.", '테스트를 보내지 못했어요. 알림을 껐다가 다시 켜 보세요.'));
    setBusy(false);
  }

  const status: Record<PushState, string> = {
    loading: '…',
    unconfigured: '',
    unsupported: t("This browser can't show notifications.", '이 브라우저는 알림을 지원하지 않아요.'),
    'ios-install': t(
      'On iPhone: tap Share → "Add to Home Screen", then open Doreham from your Home Screen to turn notifications on.',
      '아이폰: 공유 → "홈 화면에 추가"를 누른 뒤, 홈 화면의 도레함에서 알림을 켜 주세요.',
    ),
    denied: t('Blocked in your browser settings.', '브라우저 설정에서 차단되어 있어요.'),
    default: t('Off on this device', '이 기기에서 꺼짐'),
    off: t('Off on this device', '이 기기에서 꺼짐'),
    on: t('On for this device', '이 기기에서 켜짐'),
  };

  return (
    <div className="ps-card">
      <h3>{t('Notifications', '알림')}</h3>
      <div className="ps-row">
        <div>
          <div className="ps-name">{t('Push notifications', '푸시 알림')}</div>
          <div className="ps-sub">{status[state]}</div>
        </div>
        {state === 'on' ? (
          <button className="ps-btn" disabled={busy} onClick={turnOff}>{t('Turn off', '끄기')}</button>
        ) : state === 'default' || state === 'off' ? (
          <button className="ps-btn primary" disabled={busy} onClick={turnOn}>{t('Turn on', '켜기')}</button>
        ) : null}
      </div>
      {state === 'on' && (
        <button className="ps-link" disabled={busy} onClick={test}>{t('Send a test notification', '테스트 알림 보내기')}</button>
      )}
      {message && <div className="ps-msg">{message}</div>}
      <style jsx>{`
        .ps-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
        h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0 0 12px; }
        .ps-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ps-name { font-weight: 600; font-size: 14.5px; }
        .ps-sub { font-size: 13px; color: var(--ink-60); margin-top: 2px; line-height: 1.45; }
        .ps-btn { flex: none; border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 14px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: var(--body); }
        .ps-btn.primary { background: var(--persimmon); border-color: var(--persimmon); color: #fff; }
        .ps-btn:disabled, .ps-link:disabled { opacity: 0.5; }
        .ps-link { margin-top: 12px; padding: 0; border: 0; background: none; font-size: 13px; color: var(--jade); font-weight: 700; cursor: pointer; font-family: var(--body); }
        .ps-msg { margin-top: 10px; font-size: 13px; color: var(--ink-60); }
      `}</style>
    </div>
  );
}
