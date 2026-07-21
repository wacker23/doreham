'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Props = {
  profile: {
    id: string;
    display_name: string;
    home_district: string | null;
    job_title: string | null;
  };
  lang: 'en' | 'ko';
  onClose: () => void;
  onSaved: () => void;
};

export function EditBasicInfoModal({ profile, lang, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [homeDistrict, setHomeDistrict] = useState(profile.home_district ?? '');
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError(lang === 'ko' ? '이름은 2자 이상이어야 합니다.' : 'Name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        home_district: homeDistrict.trim() || null,
        job_title: jobTitle.trim() || null,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">
          {lang === 'ko' ? '기본 정보 편집' : 'Edit basic info'}
        </h2>

        <form onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="display_name">
              {lang === 'ko' ? '이름' : 'Name'}
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              className="input"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="home_district">
              {lang === 'ko' ? '거주 지역' : 'Home district'}
              <span className="optional-tag"> ({lang === 'ko' ? '선택' : 'optional'})</span>
            </label>
            <input
              id="home_district"
              type="text"
              value={homeDistrict}
              onChange={(e) => setHomeDistrict(e.target.value)}
              placeholder={lang === 'ko' ? '예: 온양동, 강남구' : 'e.g. Onyang-dong, Gangnam-gu'}
              maxLength={50}
              className="input"
              disabled={saving}
            />
          </div>

          <div className="field">
            <label htmlFor="job_title">
              {lang === 'ko' ? '직업' : 'Job title'}
              <span className="optional-tag"> ({lang === 'ko' ? '선택' : 'optional'})</span>
            </label>
            <input
              id="job_title"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={lang === 'ko' ? '예: 대학원생, 디자이너' : 'e.g. Grad student, Designer'}
              maxLength={80}
              className="input"
              disabled={saving}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
              {lang === 'ko' ? '취소' : 'Cancel'}
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving
                ? (lang === 'ko' ? '저장 중…' : 'Saving…')
                : (lang === 'ko' ? '저장' : 'Save')}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(30, 34, 48, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
          backdrop-filter: blur(4px);
        }
        .modal-card {
          background: #fff;
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          padding: 32px;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }
        .close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: 0;
          font-size: 28px;
          color: var(--ink-60);
          cursor: pointer;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-weight: 300;
        }
        .close-btn:hover {
          background: var(--paper-2);
          color: var(--ink);
        }
        .modal-title {
          font-family: var(--display);
          font-weight: 800;
          font-size: 24px;
          margin: 0 0 24px;
          color: var(--ink);
          letter-spacing: -0.02em;
        }
        .field { margin-bottom: 20px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .optional-tag { font-weight: 500; color: var(--ink-60); font-size: 13px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; font-family: var(--body); font-size: 15px; outline: none; transition: border-color 0.15s; }
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
