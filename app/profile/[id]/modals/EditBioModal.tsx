'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Props = {
  profile: { id: string; bio: string | null };
  lang: 'en' | 'ko';
  onClose: () => void;
  onSaved: () => void;
};

export function EditBioModal({ profile, lang, onClose, onSaved }: Props) {
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('profiles')
      .update({ bio: bio.trim() || null })
      .eq('id', profile.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">{lang === 'ko' ? '자기소개 편집' : 'Edit about'}</h2>
        <form onSubmit={handleSave}>
          <div className="field">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={lang === 'ko' ? '자기 자신을 소개해주세요...' : 'Introduce yourself...'}
              rows={6}
              maxLength={500}
              className="textarea"
              disabled={saving}
              autoFocus
            />
            <div className="char-count">{bio.length} / 500</div>
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
        .modal-title { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 24px; color: var(--ink); letter-spacing: -0.02em; }
        .field { margin-bottom: 20px; }
        .textarea { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; font-family: var(--body); font-size: 15px; outline: none; resize: vertical; min-height: 140px; line-height: 1.5; }
        .textarea:focus { border-color: var(--persimmon); }
        .char-count { text-align: right; font-size: 12px; color: var(--ink-60); margin-top: 4px; }
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
