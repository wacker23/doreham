'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { disablePushForSignOut } from '@/lib/push';

/** Own-profile card: delete the account for good (type a word to confirm). */
export function DeleteAccountSection({ lang }: { lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const word = ko ? '삭제' : 'DELETE';
  const ready = ['delete', '삭제'].includes(typed.trim().toLowerCase()); // either word, in either language

  async function remove() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(
          j.error === 'admin_account'
            ? t('The Doreham admin account cannot be deleted here.', '도레함 관리자 계정은 여기서 삭제할 수 없어요.')
            : t('Something went wrong and your account was not deleted. Please try again.', '문제가 생겨 계정이 삭제되지 않았어요. 다시 시도해 주세요.'),
        );
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError(t('Something went wrong. Please try again.', '문제가 생겼어요. 다시 시도해 주세요.'));
    }
    setBusy(false);
  }

  async function finish() {
    await disablePushForSignOut();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    window.location.href = '/';
  }

  if (done) {
    return (
      <div className="da-card" role="status">
        <h3>{t('Your account was deleted', '계정이 삭제됐어요')}</h3>
        <p className="da-text">
          {t(
            'Thank you for being part of Doreham. You can join again any time with the same Google account, as a new member.',
            '도레함과 함께해 주셔서 고마워요. 같은 구글 계정으로 언제든 새 회원으로 다시 가입할 수 있어요.',
          )}
        </p>
        <button type="button" className="da-btn" onClick={finish}>{t('OK, goodbye 👋', '확인 👋')}</button>
        <style jsx>{`
          .da-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
          h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0 0 8px; color: var(--ink); }
          .da-text { font-size: 14px; color: var(--ink-60); line-height: 1.5; margin: 0 0 14px; }
          .da-btn { border: 0; background: var(--ink); color: var(--paper); border-radius: 999px; padding: 10px 18px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: var(--body); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="da-card">
      <h3>{t('Delete account', '계정 삭제')}</h3>
      {!open ? (
        <div className="da-row">
          <p className="da-text">
            {t('Permanently delete your Doreham account and your data.', '도레함 계정과 내 정보를 영구히 삭제해요.')}
          </p>
          <button type="button" className="da-open" onClick={() => setOpen(true)}>
            {t('Delete my account…', '계정 삭제하기…')}
          </button>
        </div>
      ) : (
        <div className="da-confirm">
          <p className="da-text strong">{t('This cannot be undone. When you delete your account:', '되돌릴 수 없어요. 계정을 삭제하면:')}</p>
          <ul>
            <li>{t('Your profile, matches, points, badges and notifications are deleted.', '프로필, 매칭 기록, 포인트, 배지, 알림이 삭제돼요.')}</li>
            <li>{t('You leave any group you are in (the others are told) and your search stops.', '참여 중인 그룹에서 나가고(다른 멤버에게 알려요), 매칭 요청이 멈춰요.')}</li>
            <li>{t('Events you host are cancelled and your venues are removed.', '내가 연 이벤트는 취소되고 내 가게는 삭제돼요.')}</li>
            <li>{t('Your photos are deleted. Messages you sent in group chats stay, without your name.', '사진은 삭제돼요. 그룹 채팅에 보낸 메시지는 이름 없이 남아요.')}</li>
            <li>{t('Any Doreham+ time you have left is lost.', '남은 Doreham+ 기간은 사라져요.')}</li>
          </ul>
          <label className="da-label" htmlFor="da-input">
            {t(`Type ${word} to confirm`, `확인을 위해 "${word}"라고 입력하세요`)}
          </label>
          <input
            id="da-input"
            className="da-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={word}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {error && <p className="da-error" role="alert">{error}</p>}
          <div className="da-actions">
            <button
              type="button"
              className="da-cancel"
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
              disabled={busy}
            >
              {t('Cancel', '취소')}
            </button>
            <button type="button" className="da-delete" onClick={remove} disabled={!ready || busy}>
              {busy ? t('Deleting…', '삭제 중…') : t('Delete my account', '계정 삭제')}
            </button>
          </div>
        </div>
      )}
      <style jsx>{`
        .da-card { background: #fff; border: 1px solid rgba(255, 106, 61, 0.3); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
        h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0 0 8px; color: var(--ink); }
        .da-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .da-text { font-size: 14px; color: var(--ink-60); line-height: 1.5; margin: 0; }
        .da-text.strong { color: var(--ink); font-weight: 700; margin-bottom: 8px; }
        .da-open { border: 1px solid rgba(255, 106, 61, 0.4); background: #fff; color: var(--persimmon); border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; font-family: var(--body); }
        ul { margin: 0 0 14px; padding-left: 20px; display: grid; gap: 4px; }
        li { font-size: 13.5px; color: var(--ink); line-height: 1.45; }
        .da-label { display: block; font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
        .da-input { width: 100%; border: 1px solid var(--ink-12); border-radius: 10px; padding: 10px 12px; font-size: 15px; font-family: var(--body); background: #fff; color: var(--ink); }
        .da-input:focus { outline: none; border-color: var(--persimmon); }
        .da-error { font-size: 13px; color: var(--persimmon); margin: 8px 0 0; }
        .da-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .da-cancel { border: 1px solid var(--ink-12); background: #fff; color: var(--ink); border-radius: 999px; padding: 9px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: var(--body); }
        .da-delete { border: 0; background: #d64545; color: #fff; border-radius: 999px; padding: 9px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: var(--body); }
        .da-delete:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
