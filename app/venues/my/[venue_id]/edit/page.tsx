'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { BasicInfoStep } from '../../../steps/BasicInfoStep';
import { LocationStep } from '../../../steps/LocationStep';
import { HoursStep } from '../../../steps/HoursStep';
import { DescriptionStep } from '../../../steps/DescriptionStep';
import { PhotosStep } from '../../../steps/PhotosStep';
import { MenuItemsStep } from '../../../steps/MenuItemsStep';
import { ReviewStep } from '../../../steps/ReviewStep';
import { uploadPhoto } from '../../../lib/save';
import type { MenuItem, VenueFormData, VenueStep } from '../../../lib/types';
import { CATEGORY_LABELS, DEFAULT_HOURS, TOTAL_VENUE_STEPS } from '../../../lib/types';

const ERRORS: Record<string, { en: string; ko: string }> = {
  name_required: { en: 'Add the business name.', ko: '가게 이름을 입력해 주세요.' },
  legal_name_required: { en: 'Add the legal business name.', ko: '사업자등록증상 이름을 입력해 주세요.' },
  bad_registration_number: { en: 'The business registration number is not valid.', ko: '사업자등록번호가 올바르지 않아요.' },
  bad_category: { en: 'Pick a category.', ko: '업종을 선택해 주세요.' },
  bad_email: { en: 'Enter a valid contact email.', ko: '올바른 연락처 이메일을 입력해 주세요.' },
  phone_required: { en: 'Add a contact phone number.', ko: '연락처 전화번호를 입력해 주세요.' },
  address_required: { en: 'Add the address.', ko: '주소를 입력해 주세요.' },
  bad_date: { en: 'The opening date is not valid.', ko: '개업일이 올바르지 않아요.' },
  bad_cost: { en: 'The price per person is not valid.', ko: '1인 비용이 올바르지 않아요.' },
  bad_hours: { en: 'Check the opening hours.', ko: '영업시간을 확인해 주세요.' },
  too_many_photos: { en: 'You can have up to 5 photos.', ko: '사진은 5장까지 올릴 수 있어요.' },
  bad_menu: { en: 'Check the menu items.', ko: '메뉴를 확인해 주세요.' },
  menu_name_required: { en: 'Every menu item needs a name.', ko: '모든 메뉴에 이름이 필요해요.' },
  bad_price: { en: 'A menu price is not valid.', ko: '메뉴 가격이 올바르지 않아요.' },
  not_found: { en: "This venue isn't available.", ko: '이 가게를 찾을 수 없어요.' },
  not_allowed: { en: 'You can only edit your own venue.', ko: '내 가게만 수정할 수 있어요.' },
};

const u = <T,>(x: T | null | undefined) => (x ?? undefined) as T | undefined;

/** My venues → Edit: the registration steps, filled in with the saved venue. */
export default function EditVenuePage() {
  const router = useRouter();
  const params = useParams();
  const venueId = params?.venue_id as string;
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);

  const [formData, setFormData] = useState<Partial<VenueFormData> | null>(null);
  const [venueName, setVenueName] = useState('');
  const [approved, setApproved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<VenueStep>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ needs_review: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?as=venue');
      return;
    }
    (async () => {
      // The owner's contact details and registration number are only readable through the server.
      const res = await fetch(`/api/venues/${encodeURIComponent(venueId)}`);
      const body = res.ok ? await res.json().catch(() => null) : null;
      const v = body?.venue;
      if (!v || v.deactivated_at) {
        setLoadError('not_found');
        return;
      }
      const menu = (body.menu_items ?? []) as {
        id: string;
        name: string;
        name_en: string | null;
        description: string | null;
        price_won: number | null;
        is_signature: boolean;
        photo_url: string | null;
        display_order: number;
      }[];
      setVenueName(v.business_name_display ?? '');
      setApproved(!!v.is_active);
      setFormData({
        business_name_display: u(v.business_name_display),
        business_name_legal: u(v.business_name_legal),
        business_registration_number: u(v.business_registration_number),
        category: u(v.category),
        business_opened_at: v.business_opened_at ?? '',
        contact_email: u(v.contact_email),
        contact_phone: u(v.contact_phone),
        contact_name: u(v.contact_name),
        address: u(v.address),
        city: u(v.city),
        district: u(v.district),
        zipcode: u(v.zipcode),
        road_address: u(v.road_address),
        jibun_address: u(v.jibun_address),
        building_name: u(v.building_name),
        address_detail: u(v.address_detail),
        hours: v.hours_json ?? DEFAULT_HOURS,
        description: u(v.description),
        description_en: u(v.description_en),
        per_person_cost_won: u(v.per_person_cost_won),
        discount_offer: u(v.discount_offer),
        discount_offer_en: u(v.discount_offer_en),
        photo_urls: Array.isArray(v.photo_urls) ? v.photo_urls : [],
        photo_files: [],
        menu_items: (menu ?? []).map(
          (m): MenuItem => ({
            id: m.id,
            name: m.name,
            name_en: u(m.name_en),
            description: u(m.description),
            price_won: u(m.price_won),
            is_signature: !!m.is_signature,
            photo_url: u(m.photo_url),
          }),
        ),
      });
    })();
  }, [user, loading, router, venueId]);

  function advanceTo(next: VenueStep, updates: Partial<VenueFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack(prev: VenueStep) {
    setStep(prev);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const ext = (f: File) => f.name.split('.').pop() || 'jpg';

  async function save() {
    if (!formData || !user) return;
    setSaving(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const [i, file] of (formData.photo_files ?? []).entries()) {
        const url = await uploadPhoto(file, 'venue-photos', `${user.id}/${Date.now()}-${i}.${ext(file)}`);
        if (url) uploaded.push(url);
      }
      const menu = [];
      for (const [i, item] of (formData.menu_items ?? []).entries()) {
        let photoUrl = item.photo_url ?? null;
        if (item.photo_file) {
          photoUrl = await uploadPhoto(item.photo_file, 'venue-menu-photos', `${user.id}/menu-${Date.now()}-${i}.${ext(item.photo_file)}`);
        }
        menu.push({
          id: item.id,
          name: item.name,
          name_en: item.name_en ?? '',
          description: item.description ?? '',
          price_won: item.price_won ?? null,
          is_signature: item.is_signature,
          photo_url: photoUrl,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { photo_files, photo_urls, menu_items, ...fields } = formData;
      const r = await fetch(`/api/venues/${venueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, photo_urls: [...(photo_urls ?? []), ...uploaded], menu_items: menu }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m = ERRORS[j.error as string];
        setError(m ? (ko ? m.ko : m.en) : t(`Couldn't save: ${j.error ?? 'error'}`, `저장하지 못했어요: ${j.error ?? 'error'}`));
        setSaving(false);
        return;
      }
      setDone({ needs_review: !!j.needs_review });
    } catch {
      setError(t('Something went wrong. Please try again.', '문제가 생겼어요. 다시 시도해 주세요.'));
    }
    setSaving(false);
  }

  if (loading || !user) return null;

  const needsMenu = formData?.category ? CATEGORY_LABELS[formData.category].needsMenu : false;

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />
      <main className="ve-wrap">
        <a className="ve-back" href="/venues/my">← {t('My venues', '내 가게')}</a>

        {loadError ? (
          <div className="ve-card ve-center">
            <h1>{t("This venue isn't available", '이 가게를 찾을 수 없어요')}</h1>
            <a className="ve-btn" href="/venues/my">{t('Back to My venues', '내 가게로')}</a>
          </div>
        ) : !formData ? (
          <div className="ve-card ve-center">…</div>
        ) : done ? (
          <div className="ve-card ve-center">
            <div className="ve-ok" aria-hidden="true">✓</div>
            <h1>{t('Changes saved', '저장했어요')}</h1>
            <p>
              {done.needs_review
                ? t(
                    'You changed the legal name, registration number or address, so Doreham will check your venue again. It is hidden until it is approved; we will let you know.',
                    '사업자등록증상 이름, 사업자등록번호 또는 주소가 바뀌어서 도레함이 다시 확인해요. 승인될 때까지 가게가 숨겨지고, 결과를 알려드릴게요.',
                  )
                : t('Your venue page shows the new details now.', '가게 정보가 바로 바뀌었어요.')}
            </p>
            <a className="ve-btn" href="/venues/my">{t('Back to My venues', '내 가게로')}</a>
          </div>
        ) : (
          <>
            <h1 className="ve-title">{t(`Edit ${venueName}`, `${venueName} 수정`)}</h1>
            {approved && (
              <p className="ve-note">
                {t(
                  'Changing the legal name, registration number or address sends your venue back for a quick check. Everything else shows right away.',
                  '사업자등록증상 이름, 사업자등록번호, 주소를 바꾸면 다시 확인을 거쳐요. 다른 내용은 바로 반영돼요.',
                )}
              </p>
            )}
            <div className="ve-progress" aria-hidden="true">
              <div style={{ width: `${(step / TOTAL_VENUE_STEPS) * 100}%` }} />
            </div>
            <div className="ve-step">{t(`Step ${step} of ${TOTAL_VENUE_STEPS}`, `${step}단계 / ${TOTAL_VENUE_STEPS}단계`)}</div>
            <div className="ve-card">
              {step === 1 && <BasicInfoStep lang={lang} initialData={formData} onNext={(d: Partial<VenueFormData>) => advanceTo(2, d)} />}
              {step === 2 && <LocationStep lang={lang} initialData={formData} onNext={(d: Partial<VenueFormData>) => advanceTo(3, d)} onBack={() => goBack(1)} />}
              {step === 3 && <HoursStep lang={lang} initialData={formData} onNext={(d: Partial<VenueFormData>) => advanceTo(4, d)} onBack={() => goBack(2)} />}
              {step === 4 && <DescriptionStep lang={lang} initialData={formData} onNext={(d: Partial<VenueFormData>) => advanceTo(5, d)} onBack={() => goBack(3)} />}
              {step === 5 && <PhotosStep lang={lang} initialData={formData} onNext={(d: Partial<VenueFormData>) => advanceTo(6, d)} onBack={() => goBack(4)} />}
              {step === 6 && (
                <MenuItemsStep
                  lang={lang}
                  initialData={formData}
                  onNext={(d: Partial<VenueFormData>) => advanceTo(7, d)}
                  onBack={() => goBack(5)}
                  skipStep={!needsMenu}
                />
              )}
              {step === 7 && (
                <ReviewStep
                  lang={lang}
                  formData={formData as VenueFormData}
                  submitting={saving}
                  error={error}
                  onSubmit={save}
                  onBack={() => goBack(6)}
                  onEditStep={(s) => setStep(s as VenueStep)}
                  mode="edit"
                />
              )}
            </div>
          </>
        )}
      </main>
      <style jsx>{`
        .ve-wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px 80px; }
        .ve-back { display: inline-block; color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        .ve-title { font-family: var(--display); font-weight: 800; font-size: 26px; letter-spacing: -0.02em; margin: 0 0 6px; color: var(--ink); }
        .ve-note { color: var(--ink-60); font-size: 14px; line-height: 1.5; margin: 0 0 12px; }
        .ve-progress { height: 4px; background: var(--ink-12); border-radius: 999px; overflow: hidden; margin-top: 8px; }
        .ve-progress div { height: 100%; background: var(--persimmon); transition: width 0.3s; }
        .ve-step { font-size: 13px; color: var(--ink-60); font-weight: 500; margin: 8px 0 12px; }
        .ve-card { background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 24px; padding: 32px; }
        .ve-center { text-align: center; }
        .ve-center h1 { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 10px; color: var(--ink); }
        .ve-center p { color: var(--ink-60); font-size: 15px; line-height: 1.55; margin: 0 auto 20px; max-width: 46ch; }
        .ve-ok { width: 64px; height: 64px; border-radius: 50%; background: var(--jade); color: #fff; margin: 0 auto 16px; display: grid; place-items: center; font-size: 34px; font-weight: 700; }
        .ve-btn { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 15px; border-radius: 999px; padding: 12px 24px; text-decoration: none; }
        @media (max-width: 480px) {
          .ve-card { padding: 24px 18px; border-radius: 18px; }
        }
      `}</style>
    </>
  );
}
