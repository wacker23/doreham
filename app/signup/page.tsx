'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';
import { computeZodiacSign } from '../onboarding/lib/zodiac';

type SignupData = {
  display_name: string;
  gender: 'female' | 'male' | 'non_binary' |'prefer_not_to_say' | '';
  date_of_birth: string;
  exercise_frequency: string;
  education_level: string;
  drinking_habits: string;
  smoking_habits: string;
  children_status: string;
};

const INITIAL_DATA: SignupData = {
  display_name: '',
  gender: '',
  date_of_birth: '',
  exercise_frequency: '',
  education_level: '',
  drinking_habits: '',
  smoking_habits: '',
  children_status: '',
};

const TOTAL_STEPS = 8;

export default function SignupPage() {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [step, setStep] = useState(1);
  const [data, setData] = useState<SignupData>(INITIAL_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in');
      return;
    }
    // If already completed, redirect
    if (profile?.basic_signup_completed) {
      router.push('/home?welcome=true');
      return;
    }
    // Prefill display_name from Google if available
    if (user.user_metadata?.full_name && !data.display_name) {
      setData((prev) => ({ ...prev, display_name: user.user_metadata.full_name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loading, router]);

  function updateField<K extends keyof SignupData>(field: K, value: SignupData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: return data.display_name.trim().length >= 2 && termsAccepted;
      case 2: return data.gender !== '';
      case 3: return data.date_of_birth.length === 10 && isValidAge(data.date_of_birth);
      case 4: return data.exercise_frequency !== '';
      case 5: return data.education_level !== '';
      case 6: return data.drinking_habits !== '';
      case 7: return data.smoking_habits !== '';
      case 8: return data.children_status !== '';
      default: return false;
    }
  }

  function isValidAge(dob: string): boolean {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return false;
    const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 16 && age <= 100;
  }

  async function handleNext() {
    if (!canProceed()) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    // Last step — save everything
    await saveSignup();
  }

  async function saveSignup() {
    setSaving(true);
    setError(null);

    const zodiac = computeZodiacSign(data.date_of_birth);

    const { error: err } = await supabase.from('profiles').upsert({
      id: user!.id,
      display_name: data.display_name.trim(),
      gender: data.gender,
      date_of_birth: data.date_of_birth,
      zodiac_sign: zodiac,
      exercise_frequency: data.exercise_frequency,
      education_level: data.education_level,
      drinking_habits: data.drinking_habits,
      smoking_habits: data.smoking_habits,
      children_status: data.children_status,
      basic_signup_completed: true,
      onboarding_completed: false,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    router.push('/home?welcome=true');
  }

  if (loading) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (!user) return null;

  return (
    <>
      <header className="s-nav">
        <div className="wrap s-nav-in">
          <div className="brand">
            Doreham <span className="ko-mark">도레함</span>
          </div>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

      <main className="wrap main-wrap">
        {/* Progress bar */}
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
          <div className="progress-label">
            {lang === 'ko' ? `단계 ${step} / ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="step-card">
          {step === 1 && <Step1Name data={data} updateField={updateField} lang={lang} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} />}
          {step === 2 && <Step2Gender data={data} updateField={updateField} lang={lang} />}
          {step === 3 && <Step3DOB data={data} updateField={updateField} lang={lang} />}
          {step === 4 && <Step4Exercise data={data} updateField={updateField} lang={lang} />}
          {step === 5 && <Step5Education data={data} updateField={updateField} lang={lang} />}
          {step === 6 && <Step6Drinking data={data} updateField={updateField} lang={lang} />}
          {step === 7 && <Step7Smoking data={data} updateField={updateField} lang={lang} />}
          {step === 8 && <Step8Children data={data} updateField={updateField} lang={lang} />}
        </div>

        <div className="actions">
          {step > 1 ? (
            <button
              type="button"
              className="btn-back"
              onClick={() => setStep(step - 1)}
              disabled={saving}
            >
              {lang === 'ko' ? '← 이전' : '← Back'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            className="btn-next"
            onClick={handleNext}
            disabled={!canProceed() || saving}
          >
            {saving
              ? (lang === 'ko' ? '저장 중…' : 'Saving…')
              : step === TOTAL_STEPS
              ? (lang === 'ko' ? '완료 →' : 'Finish →')
              : (lang === 'ko' ? '다음 →' : 'Next →')}
          </button>
        </div>
      </main>

      <style jsx>{`
        .s-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); }
        .s-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { font-family: var(--display); font-weight: 800; font-size: 20px; color: var(--ink); display: flex; align-items: baseline; gap: 9px; }
        .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .main-wrap { padding: 32px 24px 80px; max-width: 640px; }
        .progress-wrap { margin-bottom: 32px; }
        .progress-bar { background: var(--ink-12); height: 6px; border-radius: 999px; overflow: hidden; }
        .progress-fill { background: var(--persimmon); height: 100%; transition: width 0.3s; }
        .progress-label { text-align: right; margin-top: 8px; font-size: 13px; color: var(--ink-60); font-weight: 600; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .step-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 20px; padding: 32px; margin-bottom: 20px; }
        .actions { display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-back:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 32px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </>
  );
}

// ============ STEP COMPONENTS ============

type StepProps = {
  data: SignupData;
  updateField: <K extends keyof SignupData>(field: K, value: SignupData[K]) => void;
  lang: 'en' | 'ko';
};

function Step1Name({ data, updateField, lang, termsAccepted, setTermsAccepted }: StepProps & { termsAccepted: boolean; setTermsAccepted: (v: boolean) => void }) {
  return (
    <div>
      <h2 className="step-title">
        {lang === 'ko' ? '이름을 알려주세요 👋' : "What should we call you? 👋"}
      </h2>
      <p className="step-sub">
        {lang === 'ko' ? '다른 사용자에게 보이는 이름입니다.' : "This is how you'll appear to others."}
      </p>
      <input
        type="text"
        value={data.display_name}
        onChange={(e) => updateField('display_name', e.target.value)}
        placeholder={lang === 'ko' ? '예: 소피아' : 'e.g. Sophia'}
        className="input"
        maxLength={30}
        autoFocus
      />

      <label className="terms-check">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
        />
        <span className="terms-text">
          {lang === 'ko' ? (
            <>
              <a href="/legal/terms" target="_blank" rel="noopener noreferrer">이용약관</a>과{' '}
              <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a>에 동의합니다.
            </>
          ) : (
            <>
              I agree to the <a href="/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and{' '}
              <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </>
          )}
        </span>
      </label>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .input { width: 100%; padding: 14px 18px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 16px; color: var(--ink); outline: none; }
        .input:focus { border-color: var(--persimmon); }
        .terms-check { display: flex; gap: 10px; align-items: flex-start; margin-top: 20px; cursor: pointer; padding: 12px; background: var(--paper-2); border-radius: 12px; }
        .terms-check input { margin-top: 3px; cursor: pointer; accent-color: var(--persimmon); width: 16px; height: 16px; flex-shrink: 0; }
        .terms-text { font-size: 14px; color: var(--ink); line-height: 1.5; }
        .terms-text a { color: var(--persimmon); text-decoration: underline; font-weight: 600; }
        .terms-text a:hover { text-decoration: none; }
      `}</style>
    </div>
  );
}

function Step2Gender({ data, updateField, lang }: StepProps) {
  const options = [
    { code: 'female', en: 'Woman', ko: '여성', emoji: '♀️' },
    { code: 'male', en: 'Man', ko: '남성', emoji: '♂️' },
    { code: 'non_binary', en: 'Non-binary', ko: '논바이너리', emoji: '⚧️' },
    { code: 'prefer_not_to_say', en: 'Prefer not to say', ko: '답변 안 함', emoji: '—' },
  ] as const;

  return (
    <div>
      <h2 className="step-title">
        {lang === 'ko' ? '성별을 선택해주세요' : 'Select your gender'}
      </h2>
      <p className="step-sub">
        {lang === 'ko' ? '선택 사항입니다.' : 'You can pick what feels right.'}
      </p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`option ${data.gender === o.code ? 'selected' : ''}`}
            onClick={() => updateField('gender', o.code)}
          >
            <span className="opt-emoji">{o.emoji}</span>
            <span>{lang === 'ko' ? o.ko : o.en}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .options { display: flex; flex-direction: column; gap: 10px; }
        .option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; font-family: var(--body); font-size: 15px; font-weight: 600; color: var(--ink); text-align: left; }
        .option:hover { border-color: var(--ink-60); }
        .option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .opt-emoji { font-size: 20px; }
      `}</style>
    </div>
  );
}

function Step3DOB({ data, updateField, lang }: StepProps) {
  const zodiac = data.date_of_birth ? computeZodiacSign(data.date_of_birth) : null;
  return (
    <div>
      <h2 className="step-title">
        {lang === 'ko' ? '생년월일을 알려주세요 🎂' : "When's your birthday? 🎂"}
      </h2>
      <p className="step-sub">
        {lang === 'ko' ? '별자리는 자동으로 계산됩니다.' : 'Your zodiac sign will be computed automatically.'}
      </p>
      <input
        type="date"
        value={data.date_of_birth}
        onChange={(e) => updateField('date_of_birth', e.target.value)}
        className="input"
        max={new Date(Date.now() - 16 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
      />
      {zodiac && (
        <div className="zodiac-preview">
          {lang === 'ko' ? `당신의 별자리: ` : `Your zodiac: `}
          <strong>{zodiac}</strong>
        </div>
      )}
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .input { width: 100%; padding: 14px 18px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 16px; color: var(--ink); outline: none; }
        .input:focus { border-color: var(--persimmon); }
        .zodiac-preview { margin-top: 12px; padding: 12px 16px; background: rgba(15, 157, 119, 0.08); color: var(--jade); border-radius: 10px; font-size: 15px; text-transform: capitalize; }
      `}</style>
    </div>
  );
}

function Step4Exercise({ data, updateField, lang }: StepProps) {
  const options = [
    { code: 'never', en: 'Never', ko: '전혀 안 해요', emoji: '🛋️' },
    { code: 'occasionally', en: 'Occasionally', ko: '가끔', emoji: '🚶' },
    { code: 'weekly_1_2', en: '1–2 times a week', ko: '주 1–2회', emoji: '🏃' },
    { code: 'weekly_3_4', en: '3–4 times a week', ko: '주 3–4회', emoji: '💪' },
    { code: 'daily', en: 'Almost every day', ko: '거의 매일', emoji: '🔥' },
  ];
  return (
    <div>
      <h2 className="step-title">
        {lang === 'ko' ? '운동은 얼마나 자주 하세요?' : 'How often do you exercise?'}
      </h2>
      <p className="step-sub">{lang === 'ko' ? '가벼운 산책도 포함돼요.' : 'Even light walks count!'}</p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`option ${data.exercise_frequency === o.code ? 'selected' : ''}`}
            onClick={() => updateField('exercise_frequency', o.code)}
          >
            <span className="opt-emoji">{o.emoji}</span>
            <span>{lang === 'ko' ? o.ko : o.en}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .options { display: flex; flex-direction: column; gap: 10px; }
        .option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; font-family: var(--body); font-size: 15px; font-weight: 600; color: var(--ink); text-align: left; }
        .option:hover { border-color: var(--ink-60); }
        .option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .opt-emoji { font-size: 20px; }
      `}</style>
    </div>
  );
}

function Step5Education({ data, updateField, lang }: StepProps) {
  const options = [
    { code: 'high_school', en: 'High school', ko: '고등학교', emoji: '🏫' },
    { code: 'college_student', en: 'College student', ko: '대학생 (재학중)', emoji: '📖' },
    { code: 'bachelors', en: "Bachelor's degree", ko: '학사 학위', emoji: '🎓' },
    { code: 'masters', en: "Master's degree", ko: '석사 학위', emoji: '🎓' },
    { code: 'doctoral', en: 'Doctoral degree', ko: '박사 학위', emoji: '👩‍🔬' },
    { code: 'other', en: 'Other', ko: '기타', emoji: '✨' },
  ];
  return (
    <div>
      <h2 className="step-title">{lang === 'ko' ? '학력을 선택해주세요' : 'Education level'}</h2>
      <p className="step-sub">{lang === 'ko' ? '가장 최근의 학력을 선택하세요.' : 'Your most recent level.'}</p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`option ${data.education_level === o.code ? 'selected' : ''}`}
            onClick={() => updateField('education_level', o.code)}
          >
            <span className="opt-emoji">{o.emoji}</span>
            <span>{lang === 'ko' ? o.ko : o.en}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .options { display: flex; flex-direction: column; gap: 10px; }
        .option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; font-family: var(--body); font-size: 15px; font-weight: 600; color: var(--ink); text-align: left; }
        .option:hover { border-color: var(--ink-60); }
        .option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .opt-emoji { font-size: 20px; }
      `}</style>
    </div>
  );
}

function Step6Drinking({ data, updateField, lang }: StepProps) {
  const options = [
    { code: 'no', en: "I don't drink", ko: '술을 마시지 않아요', emoji: '🚫' },
    { code: 'occasionally', en: 'Occasionally', ko: '가끔', emoji: '🍷' },
    { code: 'socially', en: 'Socially', ko: '사교적으로', emoji: '🥂' },
    { code: 'regularly', en: 'Regularly', ko: '자주', emoji: '🍺' },
    { code: 'prefer_not_to_say', en: 'Prefer not to say', ko: '답변 안 함', emoji: '—' },
  ];
  return (
    <div>
      <h2 className="step-title">{lang === 'ko' ? '음주 습관은?' : 'Drinking habits?'}</h2>
      <p className="step-sub">{lang === 'ko' ? '술 취향을 알려주세요.' : 'Just so we know.'}</p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`option ${data.drinking_habits === o.code ? 'selected' : ''}`}
            onClick={() => updateField('drinking_habits', o.code)}
          >
            <span className="opt-emoji">{o.emoji}</span>
            <span>{lang === 'ko' ? o.ko : o.en}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .options { display: flex; flex-direction: column; gap: 10px; }
        .option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; font-family: var(--body); font-size: 15px; font-weight: 600; color: var(--ink); text-align: left; }
        .option:hover { border-color: var(--ink-60); }
        .option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .opt-emoji { font-size: 20px; }
      `}</style>
    </div>
  );
}

function Step7Smoking({ data, updateField, lang }: StepProps) {
  const options = [
    { code: 'non_smoker', en: 'Non-smoker', ko: '비흡연자', emoji: '🚭' },
    { code: 'occasionally', en: 'Occasionally', ko: '가끔', emoji: '🚬' },
    { code: 'regular', en: 'Regular smoker', ko: '일상 흡연', emoji: '🚬' },
    { code: 'former', en: 'Former smoker', ko: '금연 중', emoji: '💨' },
    { code: 'vape', en: 'Vape', ko: '전자담배', emoji: '💨' },
    { code: 'prefer_not_to_say', en: 'Prefer not to say', ko: '답변 안 함', emoji: '—' },
  ];
  return (
    <div>
      <h2 className="step-title">{lang === 'ko' ? '흡연 습관은?' : 'Smoking habits?'}</h2>
      <p className="step-sub">{lang === 'ko' ? '한 가지만 선택하세요.' : 'Choose one.'}</p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`option ${data.smoking_habits === o.code ? 'selected' : ''}`}
            onClick={() => updateField('smoking_habits', o.code)}
          >
            <span className="opt-emoji">{o.emoji}</span>
            <span>{lang === 'ko' ? o.ko : o.en}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .options { display: flex; flex-direction: column; gap: 10px; }
        .option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; font-family: var(--body); font-size: 15px; font-weight: 600; color: var(--ink); text-align: left; }
        .option:hover { border-color: var(--ink-60); }
        .option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .opt-emoji { font-size: 20px; }
      `}</style>
    </div>
  );
}

function Step8Children({ data, updateField, lang }: StepProps) {
  const options = [
    { code: 'no_children', en: 'No children', ko: '자녀 없음', emoji: '👤' },
    { code: 'have_children', en: 'Have children', ko: '자녀 있음', emoji: '👨‍👩‍👧' },
    { code: 'expecting', en: 'Expecting a child', ko: '임신 중', emoji: '🤰' },
    { code: 'prefer_not_to_say', en: 'Prefer not to say', ko: '답변 안 함', emoji: '—' },
  ];
  return (
    <div>
      <h2 className="step-title">{lang === 'ko' ? '자녀 유무' : 'Children?'}</h2>
      <p className="step-sub">{lang === 'ko' ? '마지막 질문입니다!' : 'Last question!'}</p>
      <div className="options">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`option ${data.children_status === o.code ? 'selected' : ''}`}
            onClick={() => updateField('children_status', o.code)}
          >
            <span className="opt-emoji">{o.emoji}</span>
            <span>{lang === 'ko' ? o.ko : o.en}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .options { display: flex; flex-direction: column; gap: 10px; }
        .option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; font-family: var(--body); font-size: 15px; font-weight: 600; color: var(--ink); text-align: left; }
        .option:hover { border-color: var(--ink-60); }
        .option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .opt-emoji { font-size: 20px; }
      `}</style>
    </div>
  );
}
