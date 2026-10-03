'use client';

import { useCallback, useEffect, useState } from 'react';
import { VolunteerConsentModal } from '@/components/VolunteerConsentModal';

/**
 * The volunteer-photo consent: load it, withdraw it (deletes the photos), or open the
 * consent form. Used by Settings → "Volunteer quest photos" and by the card below.
 */
export function useVolunteerPhotoConsent(lang: 'en' | 'ko') {
  const [agreedAt, setAgreedAt] = useState<string | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/consents');
      const d = r.ok ? await r.json() : { consents: [] };
      const c = (d.consents ?? []).find((x: { kind: string }) => x.kind === 'volunteer_photos');
      setAgreedAt(c?.agreed_at ?? null);
    } catch {
      setAgreedAt(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one fetch on mount
    load();
  }, [load]);

  async function withdraw() {
    if (
      !confirm(
        t(
          'Withdraw your volunteer photo consent? Every group selfie and certificate you uploaded or appear in will be deleted, and you will need to agree again before your next volunteer quest.',
          '봉사 사진 동의를 철회할까요? 회원님이 올렸거나 나온 단체 사진과 확인서가 모두 삭제되고, 다음 봉사 퀘스트 전에 다시 동의해야 해요.',
        ),
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    const r = await fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'volunteer_photos', action: 'withdraw' }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMessage(
        d.error === 'active_volunteer_quest'
          ? t('Finish or leave your current volunteer quest first.', '진행 중인 봉사 퀘스트를 먼저 마치거나 나가 주세요.')
          : t('Something went wrong. Please try again.', '문제가 생겼어요. 다시 시도해 주세요.'),
      );
      return;
    }
    setMessage(t('Consent withdrawn and photos deleted.', '동의를 철회하고 사진을 삭제했어요.'));
    load();
  }

  const status =
    agreedAt === undefined
      ? '…'
      : agreedAt
        ? t(`Agreed on ${new Date(agreedAt).toLocaleDateString('en-US')}`, `${new Date(agreedAt).toLocaleDateString('ko-KR')} 동의함`)
        : t('Not agreed', '동의하지 않음');

  const modal = (
    <VolunteerConsentModal
      lang={lang}
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      onAgreed={() => {
        setModalOpen(false);
        setMessage(null);
        load();
      }}
    />
  );

  return { agreedAt, busy, message, status, withdraw, review: () => setModalOpen(true), modal };
}

/** Stand-alone card version of the same consent. */
export function PrivacyConsentsSection({ lang }: { lang: 'en' | 'ko' }) {
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);
  const { agreedAt, busy, message, status, withdraw, review, modal } = useVolunteerPhotoConsent(lang);

  return (
    <div className="pc-card">
      <h3>{t('Privacy', '개인정보')}</h3>
      <div className="pc-row">
        <div>
          <div className="pc-name">{t('Volunteer quest photos', '봉사 퀘스트 사진')}</div>
          <div className="pc-sub">{status}</div>
        </div>
        {agreedAt ? (
          <button className="pc-btn" disabled={busy} onClick={withdraw}>{t('Withdraw', '철회')}</button>
        ) : agreedAt === null ? (
          <button className="pc-btn" onClick={review}>{t('Review', '보기')}</button>
        ) : null}
      </div>
      {message && <div className="pc-msg">{message}</div>}
      <a className="pc-link" href="/legal/privacy">{t('Privacy policy', '개인정보 처리방침')} →</a>

      {modal}

      <style jsx>{`
        .pc-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
        h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0 0 12px; }
        .pc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .pc-name { font-weight: 600; font-size: 14.5px; }
        .pc-sub { font-size: 13px; color: var(--ink-60); margin-top: 2px; }
        .pc-btn { border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .pc-btn:disabled { opacity: 0.5; }
        .pc-msg { margin-top: 10px; font-size: 13px; color: var(--ink-60); }
        .pc-link { display: inline-block; margin-top: 12px; font-size: 13px; color: var(--jade); font-weight: 700; text-decoration: none; }
      `}</style>
    </div>
  );
}
