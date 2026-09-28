'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';

type Question = {
  id: string;
  set_name: 'warmup' | 'getting_real' | 'deep' | 'depths';
  text_en: string;
  text_ko: string;
  is_aron_original: boolean;
};

type Progress = {
  set_1_complete_at: string | null;
  set_2_complete_at: string | null;
  set_3_complete_at: string | null;
  set_4_complete_at: string | null;
  set_4_warning_acknowledged_at: string | null;
};

type Sets = {
  warmup: Question[];
  getting_real: Question[];
  deep: Question[];
  depths: Question[];
};

type Lang = 'en' | 'ko';

const SET_META: Record<number, { key: keyof Sets; label_en: string; label_ko: string; icon: string; blurb_en: string; blurb_ko: string }> = {
  1: { key: 'warmup', label_en: 'Warm-up', label_ko: '워밍업', icon: '☀️', blurb_en: 'Light and easy — get to know each other.', blurb_ko: '가볍고 편안하게 — 서로를 알아가요.' },
  2: { key: 'getting_real', label_en: 'Getting Real', label_ko: '진심으로', icon: '🌱', blurb_en: 'Share stories, values, and what makes you, you.', blurb_ko: '이야기, 가치관, 그리고 당신을 당신답게 만드는 것들을 나눠요.' },
  3: { key: 'deep', label_en: 'Deep', label_ko: '깊이', icon: '🌊', blurb_en: 'Real vulnerability. This is where friendship starts.', blurb_ko: '진정한 취약함. 우정이 시작되는 곳이에요.' },
  4: { key: 'depths', label_en: 'Depths', label_ko: '심연', icon: '🌑', blurb_en: 'Optional. Very personal. Only if everyone is comfortable.', blurb_ko: '선택사항. 매우 개인적. 모두가 편안할 때만.' },
};

export default function QuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const groupId = params.group_id as string;

  const [lang, setLang] = useState<Lang>('en');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sets, setSets] = useState<Sets | null>(null);
  const [activeSet, setActiveSet] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('doreham_lang') : null;
    if (stored === 'ko' || stored === 'en') setLang(stored);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/quest-questions/${groupId}`);
      const data = await resp.json();
      if (!data.ok) {
        setError(data.error ?? 'Failed to load');
      } else {
        setProgress(data.progress);
        setSets(data.sets);
        // Auto-focus first incomplete set
        if (!data.progress.set_1_complete_at) setActiveSet(1);
        else if (!data.progress.set_2_complete_at) setActiveSet(2);
        else if (!data.progress.set_3_complete_at) setActiveSet(3);
        else setActiveSet(4);
      }
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    }
    setLoading(false);
  }, [user, groupId]);

  useEffect(() => {
    if (!userLoading && user) loadData();
    if (!userLoading && !user) router.push(`/sign-in?return=/matches/${groupId}/questions`);
  }, [user, userLoading, loadData, router, groupId]);

  async function handleMarkComplete(setNum: number) {
    if (!user || marking) return;
    setMarking(true);
    try {
      const resp = await fetch('/api/mark-question-set-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, set: setNum }),
      });
      const data = await resp.json();
      if (data.ok) {
        await loadData();
        // Auto-advance to next set
        if (setNum < 4) setActiveSet(setNum + 1);
      } else {
        alert(data.error ?? 'Failed to mark complete');
      }
    } catch (e: any) {
      alert(e.message ?? 'Error');
    }
    setMarking(false);
  }

  async function handleAcknowledgeWarning() {
    if (!user) return;
    try {
      const resp = await fetch('/api/acknowledge-depths-warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      const data = await resp.json();
      if (data.ok) {
        setShowWarning(false);
        await loadData();
      } else {
        alert(data.error ?? 'Failed');
      }
    } catch (e: any) {
      alert(e.message ?? 'Error');
    }
  }

  function isSetUnlocked(setNum: number): boolean {
    if (!progress) return false;
    if (setNum === 1) return true;
    if (setNum === 2) return !!progress.set_1_complete_at;
    if (setNum === 3) return !!progress.set_2_complete_at;
    if (setNum === 4) return !!progress.set_3_complete_at && !!progress.set_4_warning_acknowledged_at;
    return false;
  }

  function isSetComplete(setNum: number): boolean {
    if (!progress) return false;
    if (setNum === 1) return !!progress.set_1_complete_at;
    if (setNum === 2) return !!progress.set_2_complete_at;
    if (setNum === 3) return !!progress.set_3_complete_at;
    if (setNum === 4) return !!progress.set_4_complete_at;
    return false;
  }

  if (userLoading || loading) {
    return (
      <main className="loading-wrap">
        <div className="spinner" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .spinner { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (error || !progress || !sets) {
    return (
      <main className="error-wrap">
        <p>{error || (lang === 'ko' ? '데이터를 불러올 수 없어요' : 'Could not load')}</p>
        <a href="/matches">{lang === 'ko' ? '매칭으로 돌아가기' : 'Back to matches'}</a>
        <style jsx>{`
          .error-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
          a { color: var(--persimmon); font-weight: 700; }
        `}</style>
      </main>
    );
  }

  const currentMeta = SET_META[activeSet];
  const currentQuestions = sets[currentMeta.key];
  const currentUnlocked = isSetUnlocked(activeSet);
  const currentComplete = isSetComplete(activeSet);

  return (
    <>
      <header className="q-nav">
        <div className="wrap q-nav-in">
          <a className="brand" href="/matches">← <span>{lang === 'ko' ? '매칭' : 'Matches'}</span></a>
          <div className="lang-switch">
            <button aria-pressed={lang === 'ko'} onClick={() => { setLang('ko'); localStorage.setItem('doreham_lang', 'ko'); }}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => { setLang('en'); localStorage.setItem('doreham_lang', 'en'); }}>English</button>
          </div>
        </div>
      </header>

      <main className="q-page">
        <div className="q-header">
          <div className="ice-icon">🧊</div>
          <h1>{lang === 'ko' ? '얼음 깨기' : 'Break the Ice'}</h1>
          <p>{lang === 'ko'
            ? '깊이 있는 대화를 통해 서로 진짜로 알아가요. 4단계로 서서히 진행됩니다.'
            : 'Real conversations to actually get to know each other. 4 sets that gradually go deeper.'}</p>
        </div>

        {/* Set tabs */}
        <div className="set-tabs">
          {[1, 2, 3, 4].map((n) => {
            const meta = SET_META[n];
            const unlocked = isSetUnlocked(n);
            const complete = isSetComplete(n);
            const isActive = activeSet === n;
            return (
              <button
                key={n}
                className={`set-tab ${isActive ? 'active' : ''} ${!unlocked ? 'locked' : ''} ${complete ? 'complete' : ''}`}
                onClick={() => {
                  if (n === 4 && !progress.set_4_warning_acknowledged_at && progress.set_3_complete_at) {
                    setShowWarning(true);
                  } else if (unlocked) {
                    setActiveSet(n);
                  }
                }}
                disabled={!unlocked && n !== 4}
              >
                <div className="set-tab-icon">{meta.icon}</div>
                <div className="set-tab-label">
                  {lang === 'ko' ? meta.label_ko : meta.label_en}
                </div>
                {complete && <div className="set-tab-check">✓</div>}
                {!unlocked && n !== 4 && <div className="set-tab-lock">🔒</div>}
              </button>
            );
          })}
        </div>

        {/* Active set content */}
        <div className="set-content">
          <div className="set-header">
            <div className="set-badge">{currentMeta.icon} {lang === 'ko' ? currentMeta.label_ko : currentMeta.label_en}</div>
            <p className="set-blurb">{lang === 'ko' ? currentMeta.blurb_ko : currentMeta.blurb_en}</p>
          </div>

          {!currentUnlocked ? (
            <div className="locked-state">
              <div className="locked-icon">🔒</div>
              <p>{lang === 'ko'
                ? '이전 단계를 완료하면 열려요'
                : 'Complete the previous set to unlock'}</p>
            </div>
          ) : (
            <>
              <div className="questions-list">
                {currentQuestions.map((q, i) => (
                  <div key={q.id} className="question-card">
                    <div className="question-num">{i + 1}</div>
                    <div className="question-text">
                      {lang === 'ko' ? q.text_ko : q.text_en}
                      {q.is_aron_original && <span className="aron-badge" title="Based on Aron's 36 Questions research">✨</span>}
                    </div>
                  </div>
                ))}
              </div>

              {!currentComplete && (
                <button
                  className="complete-btn"
                  onClick={() => handleMarkComplete(activeSet)}
                  disabled={marking}
                >
                  {marking
                    ? (lang === 'ko' ? '저장 중...' : 'Saving...')
                    : (lang === 'ko'
                        ? `이 단계 완료 · ${activeSet < 4 ? '다음 단계 열기' : '완료!'}`
                        : `Mark ${SET_META[activeSet].label_en} complete · ${activeSet < 4 ? 'Unlock next' : 'Done!'}`)}
                </button>
              )}

              {currentComplete && (
                <div className="completed-note">
                  ✓ {lang === 'ko' ? '완료됨' : 'Completed'}
                </div>
              )}
            </>
          )}
        </div>

        <p className="footer-note">
          {lang === 'ko'
            ? '✨ Aron의 36가지 질문 연구를 기반으로 함 (Aron et al., 1997)'
            : '✨ Based on Arthur Aron\'s 36 Questions research (Aron et al., 1997)'}
        </p>
      </main>

      {/* Set 4 warning modal */}
      {showWarning && (
        <div className="modal-overlay" onClick={() => setShowWarning(false)}>
          <div className="modal warning-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warning-icon">⚠️</div>
            <h2>{lang === 'ko' ? '심연 단계' : 'The Depths'}</h2>
            <p className="warning-body">
              {lang === 'ko'
                ? '이 질문들은 아프고 매우 개인적인 영역으로 들어갑니다. 강한 감정을 불러일으킬 수 있어요.'
                : 'These questions go into painful and very personal territory. They may bring up strong emotions.'}
            </p>
            <ul className="warning-list">
              <li>{lang === 'ko' ? '그룹의 모든 사람이 편안할 때만 진행하세요' : 'Only continue if everyone in your group feels comfortable'}</li>
              <li>{lang === 'ko' ? '어떤 질문이든 넘어갈 수 있어요' : 'You can skip any question'}</li>
              <li>{lang === 'ko' ? '언제든 중단할 수 있어요' : 'You can stop anytime'}</li>
              <li>{lang === 'ko' ? '나눈 이야기는 그룹 안에 머물러야 해요' : 'What is shared should stay within the group'}</li>
            </ul>
            <div className="warning-actions">
              <button className="btn-secondary" onClick={() => setShowWarning(false)}>
                {lang === 'ko' ? '취소' : 'Not yet'}
              </button>
              <button className="btn-primary" onClick={handleAcknowledgeWarning}>
                {lang === 'ko' ? '이해했어요, 계속' : 'I understand, continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .q-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .q-nav-in { display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 24px; max-width: 900px; margin: 0 auto; }
        .brand { font-family: var(--display); font-weight: 800; font-size: 16px; text-decoration: none; color: var(--ink); display: flex; align-items: center; gap: 6px; }
        .lang-switch { display: flex; gap: 4px; background: var(--paper-2); border-radius: 999px; padding: 3px; }
        .lang-switch button { background: transparent; border: 0; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--ink-60); cursor: pointer; }
        .lang-switch button[aria-pressed="true"] { background: var(--persimmon); color: #fff; }

        .q-page { max-width: 720px; margin: 0 auto; padding: 32px 20px 60px; }
        .q-header { text-align: center; margin-bottom: 32px; }
        .ice-icon { font-size: 48px; margin-bottom: 12px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 12px; color: var(--ink); }
        .q-header p { font-size: 15px; color: var(--ink-60); line-height: 1.6; margin: 0; max-width: 480px; margin-left: auto; margin-right: auto; }

        .set-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
        .set-tab { background: #fff; border: 2px solid var(--ink-12); border-radius: 14px; padding: 14px 8px; cursor: pointer; transition: all 0.15s; position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .set-tab:hover:not(.locked):not(:disabled) { border-color: var(--persimmon); }
        .set-tab.active { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.06); }
        .set-tab.complete { border-color: #4CAF50; background: rgba(76, 175, 80, 0.05); }
        .set-tab.locked { opacity: 0.5; cursor: not-allowed; }
        .set-tab-icon { font-size: 20px; }
        .set-tab-label { font-size: 12px; font-weight: 700; color: var(--ink); text-align: center; line-height: 1.2; }
        .set-tab-check { position: absolute; top: 6px; right: 6px; color: #4CAF50; font-weight: 800; font-size: 14px; }
        .set-tab-lock { position: absolute; top: 6px; right: 6px; font-size: 12px; }

        .set-content { background: #fff; border-radius: 20px; padding: 28px 24px; border: 1px solid var(--ink-12); }
        .set-header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--ink-12); }
        .set-badge { display: inline-block; background: var(--paper-2); padding: 8px 16px; border-radius: 999px; font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .set-blurb { font-size: 14px; color: var(--ink-60); line-height: 1.5; margin: 0; }

        .locked-state { text-align: center; padding: 40px 20px; color: var(--ink-60); }
        .locked-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
        .locked-state p { font-size: 14px; margin: 0; }

        .questions-list { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
        .question-card { display: flex; gap: 14px; background: var(--paper-2); padding: 16px; border-radius: 12px; }
        .question-num { flex-shrink: 0; width: 28px; height: 28px; background: var(--persimmon); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
        .question-text { font-size: 15px; line-height: 1.6; color: var(--ink); flex: 1; }
        .aron-badge { margin-left: 6px; opacity: 0.6; font-size: 12px; }

        .complete-btn { width: 100%; background: var(--persimmon); color: #fff; border: 0; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: opacity 0.15s; }
        .complete-btn:hover:not(:disabled) { opacity: 0.9; }
        .complete-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .completed-note { text-align: center; padding: 14px; color: #4CAF50; font-weight: 700; font-size: 14px; background: rgba(76, 175, 80, 0.08); border-radius: 12px; }

        .footer-note { text-align: center; margin-top: 24px; font-size: 12px; color: var(--ink-60); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; backdrop-filter: blur(4px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px 28px; max-width: 480px; width: 100%; }
        .warning-modal { text-align: center; }
        .warning-icon { font-size: 44px; margin-bottom: 12px; }
        .warning-modal h2 { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 12px; }
        .warning-body { font-size: 15px; color: var(--ink); line-height: 1.6; margin: 0 0 20px; }
        .warning-list { text-align: left; margin: 0 0 24px; padding-left: 20px; color: var(--ink-60); font-size: 14px; line-height: 1.8; }
        .warning-actions { display: flex; gap: 10px; }
        .btn-secondary, .btn-primary { flex: 1; padding: 12px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; border: 0; }
        .btn-secondary { background: var(--paper-2); color: var(--ink); }
        .btn-primary { background: var(--persimmon); color: #fff; }
      `}</style>
    </>
  );
}