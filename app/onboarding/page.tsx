'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import {LanguagesAndMbtiStep} from './steps/LanguagesAndMbtiStep'
import { LocationStep } from './steps/LocationStep';
import { InterestsStep } from './steps/InterestsStep';
import { SocialEnergyStep } from './steps/SocialEnergyStep';
import { BigFiveQuiz } from './steps/BigFiveQuiz';
import { BioAndJobStep } from './steps/BioAndJobStep';
import { savePartialProfile, completeOnboarding } from './lib/save';
import type {
  UiLanguage,
  OnboardingFormData,
  OnboardingStep,
} from './lib/types';
import { TOTAL_STEPS } from './lib/types';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useUser();

  const [lang, setLang] = useState<UiLanguage>('en');
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [formData, setFormData] = useState<Partial<OnboardingFormData>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    if (profile?.onboarding_completed) {
      router.push('/home');
      return;
    }

    if (profile) {
      setFormData((prev) => ({
        ...prev,
        display_name: prev.display_name ?? profile.display_name ?? '',
      }));
    }
  }, [user, profile, loading, router]);

  // Generic step-advance helper
  async function advanceStep(
    partial: Partial<OnboardingFormData>,
    nextStep: OnboardingStep
  ) {
    setSaving(true);
    setErrorMsg(null);

    const result = await savePartialProfile(partial);
    setSaving(false);

    if (!result.ok) {
      setErrorMsg(
        lang === 'ko'
          ? '저장 중 문제가 발생했습니다. 다시 시도해주세요.'
          : 'Failed to save. Please try again.'
      );
      return;
    }

    setFormData({ ...formData, ...partial });
    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Final completion handler
  async function finishOnboarding(bigFiveScores: {
    big_five_openness: number;
    big_five_conscientiousness: number;
    big_five_extraversion: number;
    big_five_agreeableness: number;
    big_five_neuroticism: number;
  }) {
    setSaving(true);
    setErrorMsg(null);

    // Save Big Five scores + set big_five_completed_at timestamp
    const scoresWithTimestamp = {
      ...bigFiveScores,
      big_five_completed_at: new Date().toISOString(),
    };

    const saveResult = await savePartialProfile(scoresWithTimestamp);
    if (!saveResult.ok) {
      setSaving(false);
      setErrorMsg(
        lang === 'ko'
          ? '점수 저장 중 문제가 발생했습니다.'
          : 'Failed to save results.'
      );
      return;
    }

    // Mark onboarding_completed = true
    const completeResult = await completeOnboarding();
    setSaving(false);

    if (!completeResult.ok) {
      setErrorMsg(
        lang === 'ko'
          ? '완료 처리 중 문제가 발생했습니다.'
          : 'Failed to complete onboarding.'
      );
      return;
    }

    // Success — redirect to home
    router.push('/home');
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

  if (!user || profile?.onboarding_completed) return null;

  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <>
      <header className="onboarding-nav">
        <div className="wrap onboarding-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="toggle" role="group" aria-label="Language">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

      <div className="progress-wrap" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="wrap step-indicator">
        <span>
          {lang === 'ko'
            ? `${currentStep}단계 / ${TOTAL_STEPS}단계`
            : `Step ${currentStep} of ${TOTAL_STEPS}`}
        </span>
      </div>

      <main className="onboarding-wrap">
        <div className="onboarding-card">
          {errorMsg && (
            <div className="error-banner" role="alert">
              {errorMsg}
            </div>
          )}

          {currentStep === 1 && (
            <LanguagesAndMbtiStep
              lang={lang}
              initialData={formData}
              onNext={(data) => advanceStep(data, 2)}
              saving={saving}
            />
          )}

          {currentStep === 2 && (
            <LocationStep
              lang={lang}
              initialData={formData}
              onNext={(data) => advanceStep(data, 3)}
              onBack={() => setCurrentStep(1)}
              saving={saving}
            />
          )}

          {currentStep === 3 && (
            <InterestsStep
              lang={lang}
              initialData={formData}
              onNext={(data) => advanceStep(data, 4)}
              onBack={() => setCurrentStep(2)}
              saving={saving}
            />
          )}

          {currentStep === 4 && (
            <SocialEnergyStep
              lang={lang}
              initialData={formData}
              onNext={(data) => advanceStep(data, 5)}
              onBack={() => setCurrentStep(3)}
              saving={saving}
            />
          )}

          {currentStep === 5 && (
            <BigFiveQuiz
              lang={lang}
              onNext={async (bigFiveScores) => {
                // Save Big Five scores, then advance to bio step
                setSaving(true);
                setErrorMsg(null);
                const scoresWithTimestamp = {
                  ...bigFiveScores,
                  big_five_completed_at: new Date().toISOString(),
                };
                const result = await savePartialProfile(scoresWithTimestamp);
                setSaving(false);
                if (!result.ok) {
                  setErrorMsg(
                    lang === 'ko'
                      ? '점수 저장 중 문제가 발생했습니다.'
                      : 'Failed to save results.'
                  );
                  return;
                }
                setFormData({ ...formData, ...bigFiveScores });
                setCurrentStep(6);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onBack={() => setCurrentStep(4)}
              saving={saving}
            />
          )}

          {currentStep === 6 && (
            <BioAndJobStep
              lang={lang}
              initialData={formData}
              onNext={async (bioData) => {
                // Save bio + job_title, then complete onboarding
                setSaving(true);
                setErrorMsg(null);
                const result = await savePartialProfile(bioData);
                if (!result.ok) {
                  setSaving(false);
                  setErrorMsg(
                    lang === 'ko'
                      ? '저장 중 문제가 발생했습니다.'
                      : 'Failed to save.'
                  );
                  return;
                }
                const completeResult = await completeOnboarding();
                setSaving(false);
                if (!completeResult.ok) {
                  setErrorMsg(
                    lang === 'ko'
                      ? '완료 처리 중 문제가 발생했습니다.'
                      : 'Failed to complete onboarding.'
                  );
                  return;
                }
                router.push('/home');
              }}
              onBack={() => setCurrentStep(5)}
              saving={saving}
            />
          )}
        </div>
      </main>

      <style jsx>{`
        .onboarding-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; }
        .onboarding-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .brand .ko-mark { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }

        .progress-wrap { height: 3px; background: var(--ink-12); overflow: hidden; position: sticky; top: 68px; z-index: 9; }
        .progress-bar { height: 100%; background: var(--persimmon); transition: width 0.35s ease; }
        .step-indicator { padding: 12px 24px 0; font-size: 13px; color: var(--ink-60); font-weight: 500; }

        .onboarding-wrap { min-height: calc(100vh - 68px - 30px); padding: 24px 24px 60px; display: flex; justify-content: center; }
        .onboarding-card { max-width: 640px; width: 100%; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 24px; padding: 40px; }
        .error-banner { margin-bottom: 20px; padding: 12px 16px; border-radius: 12px; background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); font-size: 14px; }

        @media (max-width: 480px) {
          .onboarding-card { padding: 28px 20px; border-radius: 16px; }
        }
      `}</style>
    </>
  );
}
