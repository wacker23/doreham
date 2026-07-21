'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ja', label: '日本語' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'th', label: 'ภาษาไทย' },
  { code: 'ru', label: 'Русский' },
  { code: 'uz', label: 'Oʻzbek' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'mn', label: 'Монгол' },
  { code: 'ne', label: 'नेपाली' },
  { code: 'my', label: 'မြန်မာ' },
  { code: 'km', label: 'ខ្មែរ' },
  { code: 'ur', label: 'اردو' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'fa', label: 'فارسی' },
  { code: 'ar', label: 'العربية' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pl', label: 'Polski' },
  { code: 'uk', label: 'Українська' },
  { code: 'kk', label: 'Қазақ' },
  { code: 'ky', label: 'Кыргыз' },
  { code: 'other', label: 'Other' },
];

const KNOWN_CODES = new Set(LANGUAGES.map((l) => l.code));

type Props = {
  profile: { id: string; primary_language: string | null; spoken_languages: string[] | null };
  lang: 'en' | 'ko';
  onClose: () => void;
  onSaved: () => void;
};

export function EditLanguagesModal({ profile, lang, onClose, onSaved }: Props) {
  // Split existing spoken_languages into known codes vs custom text
  const initialSpoken = profile.spoken_languages ?? [];
  const initialKnown = initialSpoken.filter((l) => KNOWN_CODES.has(l));
  const initialCustom = initialSpoken.filter((l) => !KNOWN_CODES.has(l));

  const [primary, setPrimary] = useState(profile.primary_language ?? 'en');
  const [spoken, setSpoken] = useState<string[]>(initialKnown);
  const [customLang, setCustomLang] = useState(initialCustom[0] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSpoken(code: string) {
    setSpoken((prev) => {
      if (prev.includes(code)) return prev.filter((l) => l !== code);
      return [...prev, code];
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Ensure primary is included
    let finalSpoken = spoken.includes(primary) ? spoken : [primary, ...spoken];

    // Replace 'other' with custom text
    if (finalSpoken.includes('other') && customLang.trim()) {
      finalSpoken = finalSpoken.filter((l) => l !== 'other');
      finalSpoken.push(customLang.trim());
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({
        primary_language: primary,
        spoken_languages: finalSpoken,
      })
      .eq('id', profile.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">{lang === 'ko' ? '언어 편집' : 'Edit languages'}</h2>
        <form onSubmit={handleSave}>
          <div className="field">
            <label>{lang === 'ko' ? '주 사용 언어' : 'Primary language'}</label>
            <select value={primary} onChange={(e) => setPrimary(e.target.value)} className="input" disabled={saving}>
              {LANGUAGES.filter((l) => l.code !== 'other').map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{lang === 'ko' ? '구사 가능한 언어' : 'Other languages you speak'}</label>
            <div className="chips">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`chip ${spoken.includes(l.code) ? 'selected' : ''}`}
                  onClick={() => toggleSpoken(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {spoken.includes('other') && (
              <input
                type="text"
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value)}
                placeholder={lang === 'ko' ? '어떤 언어인가요?' : 'Which language?'}
                maxLength={30}
                className="input"
                style={{ marginTop: 10 }}
                disabled={saving}
              />
            )}
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
        .modal-card { background: #fff; border-radius: 20px; width: 100%; max-width: 600px; padding: 32px; position: relative; max-height: 90vh; overflow-y: auto; }
        .close-btn { position: absolute; top: 12px; right: 12px; background: transparent; border: 0; font-size: 28px; color: var(--ink-60); cursor: pointer; width: 40px; height: 40px; border-radius: 50%; font-weight: 300; }
        .close-btn:hover { background: var(--paper-2); color: var(--ink); }
        .modal-title { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 24px; color: var(--ink); letter-spacing: -0.02em; }
        .field { margin-bottom: 20px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; font-family: var(--body); font-size: 15px; outline: none; background: #fff; }
        .input:focus { border-color: var(--persimmon); }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip { padding: 8px 14px; background: var(--paper-2); border: 2px solid transparent; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink); }
        .chip:hover { border-color: var(--ink-60); }
        .chip.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.08); color: var(--persimmon); }
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
