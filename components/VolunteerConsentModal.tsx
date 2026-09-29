'use client';

import { useState } from 'react';

/**
 * Consent for volunteer (봉사) quests: the group selfie that finishes the quest, the optional 1365
 * certificate and the optional location on the selfie. Recorded server-side (/api/consents).
 * Keep the wording in sync with /legal/privacy and CONSENT_VERSIONS in lib/server/consents.ts.
 */
export function VolunteerConsentModal({
  lang,
  open,
  onClose,
  onAgreed,
}: {
  lang: 'en' | 'ko';
  open: boolean;
  onClose: () => void;
  onAgreed: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);

  if (!open) return null;

  async function agree() {
    if (!checked || saving) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'volunteer_photos', action: 'grant' }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? 'failed');
      setSaving(false);
      setChecked(false);
      onAgreed();
    } catch {
      setSaving(false);
      setError(t('Could not save your answer. Please try again.', '저장하지 못했어요. 다시 시도해 주세요.'));
    }
  }

  return (
    <div className="vc-backdrop" role="dialog" aria-modal="true" aria-labelledby="vc-title" onClick={onClose}>
      <div className="vc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="vc-emoji">🤝📸</div>
        <h2 id="vc-title">{t('Before your first volunteer quest', '첫 봉사 퀘스트 전에')}</h2>
        <ul>
          <li>
            {t(
              'A volunteer quest finishes with one group selfie at the activity. Only your group can see it, and it is deleted automatically after 90 days.',
              '봉사 퀘스트는 활동 장소에서 찍은 단체 사진 한 장으로 완료돼요. 사진은 우리 그룹만 볼 수 있고, 90일 뒤 자동으로 삭제돼요.',
            )}
          </li>
          <li>
            {t(
              'If a groupmate uploads the selfie, you will be tagged in it. People not in any photo count as a no-show.',
              '다른 멤버가 사진을 올리면 사진 속 멤버로 표시돼요. 어떤 사진에도 없는 멤버는 불참으로 처리돼요.',
            )}
          </li>
          <li>
            {t(
              'Optional: your 1365 certificate (image or PDF), kept the same way. Optional: your phone location when you upload the selfie, kept with the photo.',
              '선택: 1365 봉사활동 확인서(사진 또는 PDF)도 같은 방식으로 보관돼요. 선택: 사진을 올릴 때의 휴대폰 위치가 사진과 함께 보관돼요.',
            )}
          </li>
          <li>
            {t(
              'You sign up on 1365 yourself. Doreham does not send your details to 1365.',
              '1365 신청은 직접 하세요. 도레함은 회원님의 정보를 1365에 보내지 않아요.',
            )}
          </li>
          <li>
            {t(
              'You can withdraw any time on your profile. We then delete every photo you uploaded or appear in.',
              '프로필에서 언제든 동의를 철회할 수 있어요. 철회하면 회원님이 올렸거나 나온 사진을 모두 삭제해요.',
            )}
          </li>
        </ul>
        <label className="vc-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>
            {t('I agree (needed for volunteer quests).', '위 내용에 동의해요 (봉사 퀘스트 참여에 필요).')}{' '}
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">
              {t('Privacy policy', '개인정보 처리방침')}
            </a>
          </span>
        </label>
        {error && <div className="vc-error">{error}</div>}
        <button className="vc-agree" disabled={!checked || saving} onClick={agree}>
          {saving ? t('Saving…', '저장 중…') : t('Agree and continue', '동의하고 계속하기')}
        </button>
        <button className="vc-later" onClick={onClose}>{t('Not now', '나중에')}</button>
      </div>

      <style jsx>{`
        .vc-backdrop { position: fixed; inset: 0; background: rgba(20, 20, 20, 0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 100; padding: 16px; }
        @media (min-width: 640px) { .vc-backdrop { align-items: center; } }
        .vc-sheet { background: var(--paper, #fff); border-radius: 20px; padding: 24px 22px 18px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2); }
        .vc-emoji { font-size: 36px; text-align: center; }
        h2 { font-family: var(--display); font-weight: 800; font-size: 20px; text-align: center; margin: 8px 0 14px; color: var(--ink); }
        ul { margin: 0 0 16px; padding-left: 20px; }
        li { font-size: 14px; line-height: 1.6; color: var(--ink); margin-bottom: 8px; }
        .vc-check { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.5; color: var(--ink); margin-bottom: 14px; cursor: pointer; }
        .vc-check input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
        .vc-check a { color: var(--jade); font-weight: 700; }
        .vc-error { color: var(--persimmon); font-size: 13.5px; margin-bottom: 10px; }
        .vc-agree { width: 100%; border: 0; border-radius: 12px; padding: 13px; font-weight: 700; font-size: 15px; color: #fff; background: linear-gradient(135deg, #0f9d77, #34c39a); cursor: pointer; }
        .vc-agree:disabled { opacity: 0.5; cursor: default; }
        .vc-later { width: 100%; margin-top: 8px; border: 0; background: transparent; color: var(--ink-60); font-size: 14px; padding: 8px; cursor: pointer; }
      `}</style>
    </div>
  );
}
