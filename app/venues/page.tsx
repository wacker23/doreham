'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { LocationStep } from './steps/LocationStep';
import { HoursStep } from './steps/HoursStep';
import { DescriptionStep } from './steps/DescriptionStep';
import { PhotosStep } from './steps/PhotosStep';
import { MenuItemsStep } from './steps/MenuItemsStep';
import { ReviewStep } from './steps/ReviewStep';
import { uploadPhoto, submitVenue } from './lib/save';
import type { UiLanguage, VenueFormData, VenueStep, MenuItem } from './lib/types';
import { CATEGORY_LABELS, DEFAULT_HOURS, TOTAL_VENUE_STEPS } from './lib/types';

export default function VenueRegisterPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [lang, setLang] = useState<UiLanguage>('en');
  const [currentStep, setCurrentStep] = useState<VenueStep>(1);
  const [formData, setFormData] = useState<Partial<VenueFormData>>({
    hours: DEFAULT_HOURS,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successVenueId, setSuccessVenueId] = useState<string | null>(null);

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Auth gate
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/venues');
    }
  }, [user, loading, router]);

  function advanceTo(nextStep: VenueStep, updates: Partial<VenueFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack(prevStep: VenueStep) {
    setCurrentStep(prevStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    if (!user) {
      setSubmitError(lang === 'ko' ? '로그인이 필요합니다.' : 'Please sign in first.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload venue photos
      const uploadedPhotoUrls: string[] = [];
      if (formData.photo_files && formData.photo_files.length > 0) {
        for (let i = 0; i < formData.photo_files.length; i++) {
          const file = formData.photo_files[i];
          const ext = file.name.split('.').pop() ?? 'jpg';
          const path = `${user.id}/${Date.now()}-${i}.${ext}`;
          const url = await uploadPhoto(file, 'venue-photos', path);
          if (url) uploadedPhotoUrls.push(url);
        }
      }

      // 2. Upload menu item photos + prepare menu items
      const uploadedMenuItems: MenuItem[] = [];
      if (formData.menu_items && formData.menu_items.length > 0) {
        for (let i = 0; i < formData.menu_items.length; i++) {
          const item = formData.menu_items[i];
          let photo_url: string | undefined = undefined;

          if (item.photo_file) {
            const ext = item.photo_file.name.split('.').pop() ?? 'jpg';
            const path = `${user.id}/menu-${Date.now()}-${i}.${ext}`;
            const url = await uploadPhoto(item.photo_file, 'venue-menu-photos', path);
            if (url) photo_url = url;
          }

          uploadedMenuItems.push({
            name: item.name,
            name_en: item.name_en,
            description: item.description,
            price_won: item.price_won,
            is_signature: item.is_signature,
            photo_url,
          });
        }
      }

      // 3. Submit to database
      const result = await submitVenue(formData, uploadedPhotoUrls, uploadedMenuItems);
      setSubmitting(false);

      if (!result.ok) {
        setSubmitError(
          lang === 'ko'
            ? `제출 중 오류가 발생했습니다: ${result.error}`
            : `Submission failed: ${result.error}`
        );
        return;
      }

      setSuccessVenueId(result.venueId);
    } catch (e) {
      setSubmitting(false);
      console.error('Submit error:', e);
      setSubmitError(
        lang === 'ko'
          ? '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.'
          : 'An unexpected error occurred. Please try again.'
      );
    }
  }

  // Check if current category needs menu items
  const needsMenu = formData.category
    ? CATEGORY_LABELS[formData.category].needsMenu
    : false;

  // Loading
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

  // Success screen
  if (successVenueId) {
    return (
      <>
        <header className="v-nav">
          <div className="wrap v-nav-in">
            <a className="brand" href="/">
              Doreham <span className="ko-mark">도레함</span>
            </a>
          </div>
        </header>

        <main className="success-wrap">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h1>
              {lang === 'ko' ? '제출 완료!' : 'Submitted!'}
            </h1>
            <p>
              {lang === 'ko'
                ? '가게 등록 요청이 접수되었습니다. 관리자 검토 후 48시간 이내로 이메일로 알려드리겠습니다.'
                : "We got your submission. We'll review and email you within 48 hours."}
            </p>
            <p className="thanks">
              {lang === 'ko'
                ? '도레함에 함께해 주셔서 감사합니다!'
                : 'Thank you for joining Doreham!'}
            </p>
            <div className="success-actions">
              <a href="/" className="btn-home">
                {lang === 'ko' ? '홈으로' : 'Back to home'}
              </a>
            </div>
          </div>
        </main>

        <style jsx>{`
          .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); }
          .v-nav-in { display: flex; align-items: center; height: 68px; }
          .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
          .brand .ko-mark { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; color: var(--ink-60); font-weight: 700; font-size: 17px; }
          .success-wrap { min-height: calc(100vh - 68px); display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
          .success-card { max-width: 480px; width: 100%; text-align: center; background: var(--paper-2); border-radius: 24px; padding: 48px 32px; border: 1px solid var(--ink-12); }
          .success-icon { width: 72px; height: 72px; border-radius: 50%; background: var(--jade); color: #fff; margin: 0 auto 24px; display: grid; place-items: center; font-size: 40px; font-weight: 700; animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
          @keyframes pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
          h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 16px; letter-spacing: -0.02em; }
          p { color: var(--ink-60); font-size: 15.5px; line-height: 1.55; margin: 0 0 12px; }
          .thanks { color: var(--persimmon); font-weight: 600; margin-top: 16px; }
          .success-actions { margin-top: 32px; }
          .btn-home { display: inline-block; background: var(--ink); color: var(--paper); padding: 12px 28px; border-radius: 999px; font-weight: 700; font-size: 14px; text-decoration: none; transition: transform 0.12s; }
          .btn-home:hover { transform: translateY(-1px); }
        `}</style>
      </>
    );
  }

  const progress = (currentStep / TOTAL_VENUE_STEPS) * 100;

  return (
    <>
      <header className="v-nav">
        <div className="wrap v-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

      <div className="progress-bar-wrap">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="wrap step-indicator">
        {lang === 'ko'
          ? `${currentStep}단계 / ${TOTAL_VENUE_STEPS}단계`
          : `Step ${currentStep} of ${TOTAL_VENUE_STEPS}`}
      </div>

      <main className="v-wrap">
        <div className="v-card">
          {currentStep === 1 && (
            <BasicInfoStep
              lang={lang}
              initialData={formData}
              onNext={(data: Partial<VenueFormData>) => advanceTo(2, data)}
            />
          )}
          {currentStep === 2 && (
            <LocationStep
              lang={lang}
              initialData={formData}
              onNext={(data: Partial<VenueFormData>) => advanceTo(3, data)}
              onBack={() => goBack(1)}
            />
          )}
          {currentStep === 3 && (
            <HoursStep
              lang={lang}
              initialData={formData}
              onNext={(data: Partial<VenueFormData>) => advanceTo(4, data)}
              onBack={() => goBack(2)}
            />
          )}
          {currentStep === 4 && (
            <DescriptionStep
              lang={lang}
              initialData={formData}
              onNext={(data: Partial<VenueFormData>) => advanceTo(5, data)}
              onBack={() => goBack(3)}
            />
          )}
          {currentStep === 5 && (
            <PhotosStep
              lang={lang}
              initialData={formData}
              onNext={(data: Partial<VenueFormData>) => advanceTo(6, data)}
              onBack={() => goBack(4)}
            />
          )}
          {currentStep === 6 && (
            <MenuItemsStep
              lang={lang}
              initialData={formData}
              onNext={(data: Partial<VenueFormData>) => advanceTo(7, data)}
              onBack={() => goBack(5)}
              skipStep={!needsMenu}
            />
          )}
          {currentStep === 7 && (
            <ReviewStep
              lang={lang}
              formData={formData}
              submitting={submitting}
              error={submitError}
              onSubmit={handleSubmit}
              onBack={() => goBack(6)}
              onEditStep={(step) => setCurrentStep(step as VenueStep)}
            />
          )}
        </div>
      </main>

      <style jsx>{`
        .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .v-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .brand .ko-mark { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .progress-bar-wrap { height: 3px; background: var(--ink-12); overflow: hidden; position: sticky; top: 68px; z-index: 9; }
        .progress-bar { height: 100%; background: var(--persimmon); transition: width 0.35s ease; }
        .step-indicator { padding: 12px 24px 0; font-size: 13px; color: var(--ink-60); font-weight: 500; }
        .v-wrap { min-height: calc(100vh - 68px - 30px); padding: 24px 24px 60px; display: flex; justify-content: center; }
        .v-card { max-width: 640px; width: 100%; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 24px; padding: 40px; }
        @media (max-width: 480px) {
          .v-card { padding: 28px 20px; border-radius: 16px; }
        }
      `}</style>
    </>
  );
}