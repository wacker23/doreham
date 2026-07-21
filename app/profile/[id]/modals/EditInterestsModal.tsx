'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const ACTIVITIES = [
  { code: 'conversation_coffee', en: 'Coffee chats', ko: '커피 대화', emoji: '☕' },
  { code: 'board_games_casual', en: 'Board games', ko: '보드게임', emoji: '🎲' },
  { code: 'workshops_creative', en: 'Creative workshops', ko: '창작 클래스', emoji: '🏺' },
  { code: 'active_outdoor', en: 'Active outdoors', ko: '야외 활동', emoji: '🥾' },
  { code: 'food_dining', en: 'Food & dining', ko: '음식·식사', emoji: '🍜' },
  { code: 'learning_culture', en: 'Learning culture', ko: '문화 배우기', emoji: '📚' },
  { code: 'nature_calm', en: 'Nature calm', ko: '자연 힐링', emoji: '🌿' },
  { code: 'escape_puzzles', en: 'Escape & puzzles', ko: '방탈출·퍼즐', emoji: '🧩' },
  { code: 'movies_music_shows', en: 'Movies & music', ko: '영화·음악', emoji: '🎬' },
  { code: 'career_networking', en: 'Career networking', ko: '커리어 네트워킹', emoji: '💼' },
  { code: 'volunteering_community', en: 'Volunteering', ko: '봉사·커뮤니티', emoji: '🤝' },
  { code: 'nightlife_social', en: 'Nightlife', ko: '나이트라이프', emoji: '🌃' },
];

type Props = {
  profile: { id: string; activity_preferences: string[] | null; interests: string[] | null };
  lang: 'en' | 'ko';
  onClose: () => void;
  onSaved: () => void;
};

export function EditInterestsModal({ profile, lang, onClose, onSaved }: Props) {
  // Merge both activity_preferences and interests for editing
  const [selected, setSelected] = useState<string[]>(profile.activity_preferences ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(code: string) {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError(lang === 'ko' ? '최소 1개 이상 선택해주세요.' : 'Select at least one.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('profiles')
      .update({ activity_preferences: selected })
      .eq('id', profile.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">{lang === 'ko' ? '좋아하는 활동' : 'Loves to do'}</h2>
        <p className="modal-sub">{lang === 'ko' ? '관심 있는 활동을 모두 선택하세요.' : 'Pick everything you enjoy.'}</p>
        <form onSubmit={handleSave}>
          <div className="chips">
            {ACTIVITIES.map((a) => (
              <button
                key={a.code}
                type="button"
                className={`chip ${selected.includes(a.code) ? 'selected' : ''}`}
                onClick={() => toggle(a.code)}
              >
                <span>{a.emoji}</span>
                <span>{lang === 'ko' ? a.ko : a.en}</span>
              </button>
            ))}
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
        .modal-title { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 8px; color: var(--ink); letter-spacing: -0.02em; }
        .modal-sub { color: var(--ink-60); font-size: 14px; margin: 0 0 24px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--paper-2); border: 2px solid transparent; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink); }
        .chip:hover { border-color: var(--ink-60); }
        .chip.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.08); color: var(--persimmon); }
        .error-msg { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; margin-top: 16px; }
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
