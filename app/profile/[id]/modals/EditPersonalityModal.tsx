'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const MBTI_OPTIONS = [
  { code: 'INTJ', en: 'INTJ · The Architect', ko: 'INTJ · 전략가' },
  { code: 'INTP', en: 'INTP · The Logician', ko: 'INTP · 논리술사' },
  { code: 'ENTJ', en: 'ENTJ · The Commander', ko: 'ENTJ · 통솔자' },
  { code: 'ENTP', en: 'ENTP · The Debater', ko: 'ENTP · 변론가' },
  { code: 'INFJ', en: 'INFJ · The Advocate', ko: 'INFJ · 옹호자' },
  { code: 'INFP', en: 'INFP · The Mediator', ko: 'INFP · 중재자' },
  { code: 'ENFJ', en: 'ENFJ · The Protagonist', ko: 'ENFJ · 선도자' },
  { code: 'ENFP', en: 'ENFP · The Campaigner', ko: 'ENFP · 활동가' },
  { code: 'ISTJ', en: 'ISTJ · The Logistician', ko: 'ISTJ · 현실주의자' },
  { code: 'ISFJ', en: 'ISFJ · The Defender', ko: 'ISFJ · 수호자' },
  { code: 'ESTJ', en: 'ESTJ · The Executive', ko: 'ESTJ · 경영자' },
  { code: 'ESFJ', en: 'ESFJ · The Consul', ko: 'ESFJ · 집정관' },
  { code: 'ISTP', en: 'ISTP · The Virtuoso', ko: 'ISTP · 장인' },
  { code: 'ISFP', en: 'ISFP · The Adventurer', ko: 'ISFP · 모험가' },
  { code: 'ESTP', en: 'ESTP · The Entrepreneur', ko: 'ESTP · 사업가' },
  { code: 'ESFP', en: 'ESFP · The Entertainer', ko: 'ESFP · 연예인' },
];

type Props = {
  profile: { id: string; mbti_type: string | null };
  lang: 'en' | 'ko';
  onClose: () => void;
  onSaved: () => void;
};

export function EditPersonalityModal({ profile, lang, onClose, onSaved }: Props) {
  const [mbti, setMbti] = useState(profile.mbti_type ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('profiles')
      .update({ mbti_type: mbti || null })
      .eq('id', profile.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">{lang === 'ko' ? 'MBTI 편집' : 'Edit personality'}</h2>
        <p className="modal-sub">
          {lang === 'ko' ? '별자리는 생년월일에서 자동 계산됩니다.' : 'Zodiac is auto-computed from your DOB.'}
        </p>
        <form onSubmit={handleSave}>
          <div className="field">
            <label>MBTI</label>
            <select value={mbti} onChange={(e) => setMbti(e.target.value)} className="input" disabled={saving}>
              <option value="">{lang === 'ko' ? '선택하지 않음' : "I'd rather not say"}</option>
              {MBTI_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {lang === 'ko' ? opt.ko : opt.en}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
              {lang === 'ko' ? '취소' : 'Cancel'}
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? (lang === 'ko' ? '저장 중…' : 'Saving…') : (lang === 'ko' ? '저장' : 'Save')}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        .modal-backdrop { position: fixed; inset: 0; background: rgba(30, 34, 48, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; backdrop-filter: blur(4px); }
        .modal-card { background: #fff; border-radius: 20px; width: 100%; max-width: 500px; padding: 32px; position: relative; max-height: 90vh; overflow-y: auto; }
        .close-btn { position: absolute; top: 12px; right: 12px; background: transparent; border: 0; font-size: 28px; color: var(--ink-60); cursor: pointer; width: 40px; height: 40px; border-radius: 50%; font-weight: 300; }
        .close-btn:hover { background: var(--paper-2); color: var(--ink); }
        .modal-title { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 8px; color: var(--ink); letter-spacing: -0.02em; }
        .modal-sub { color: var(--ink-60); font-size: 14px; margin: 0 0 24px; }
        .field { margin-bottom: 20px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; font-family: var(--body); font-size: 15px; outline: none; background: #fff; }
        .input:focus { border-color: var(--persimmon); }
        .error-msg { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
        .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
        .btn-cancel { background: transparent; border: 1px solid var(--ink-12); padding: 10px 20px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; color: var(--ink); }
        .btn-cancel:hover { background: var(--paper-2); }
        .btn-save { background: var(--persimmon); color: #fff; border: 0; padding: 10px 24px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 14px; cursor: pointer; }
        .btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-save:disabled, .btn-cancel:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
