'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Venue = {
  id: string;
  business_name_display: string;
  owner_id: string;
  is_active: boolean;
};

type QrInfo = {
  id: string;
  code: string;
  valid_date: string;
};

export default function VenueQrPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const params = useParams();
  const venueId = params?.venue_id as string;

  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [venue, setVenue] = useState<Venue | null>(null);
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLang((document.body.dataset.lang as 'en' | 'ko') ?? 'en');
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push(`/sign-in?return=/venues/my/${venueId}/qr`); return; }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, venueId]);

  async function loadAll() {
    setLoadingData(true);
    setError(null);

    // Verify venue ownership
    const { data: v } = await supabase
      .from('venues')
      .select('id, business_name_display, owner_id, is_active')
      .eq('id', venueId)
      .maybeSingle();

    if (!v) {
      setError(lang === 'ko' ? '매장을 찾을 수 없어요.' : 'Venue not found.');
      setLoadingData(false);
      return;
    }

    if (v.owner_id !== user!.id) {
      setError(lang === 'ko' ? '이 매장의 소유자가 아니에요.' : "You don't own this venue.");
      setLoadingData(false);
      return;
    }

    setVenue(v);

    // Get today's QR code
    try {
      const resp = await fetch(`/api/venue-qr/${venueId}`);
      const qrData = await resp.json();
      if (qrData.error) {
        setError(qrData.error);
      } else {
        setQr({ id: qrData.id, code: qrData.code, valid_date: qrData.valid_date });
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load QR');
    }

    setLoadingData(false);
  }

  function printQr() {
    window.print();
  }

  if (loading || loadingData) {
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

  if (error) {
    return (
      <main className="err-wrap">
        <div className="err-icon">⚠️</div>
        <h1>{lang === 'ko' ? '접근 오류' : 'Access error'}</h1>
        <p>{error}</p>
        <a href="/venues/my" className="btn-back">{lang === 'ko' ? '내 매장으로' : 'Back to my venues'}</a>
        <style jsx>{`
          .err-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
          .err-icon { font-size: 48px; margin-bottom: 16px; }
          h1 { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 8px; }
          p { color: var(--ink-60); margin: 0 0 24px; }
          .btn-back { background: var(--ink); color: var(--paper); text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; }
        `}</style>
      </main>
    );
  }

  if (!venue || !qr) return null;

  // QR image URL — use a public QR generation service (quickchart.io is reliable + free)
  const qrPayload = encodeURIComponent(qr.code);
  const qrImageUrl = `https://quickchart.io/qr?text=${qrPayload}&size=400&margin=2`;

  return (
    <main className="qr-wrap">
      <header className="qr-header no-print">
        <a href="/venues/my" className="back-btn">←</a>
        <div className="header-title">{lang === 'ko' ? '오늘의 QR 코드' : "Today's QR"}</div>
        <button onClick={printQr} className="print-btn">🖨️ {lang === 'ko' ? '인쇄' : 'Print'}</button>
      </header>

      <div className="content">
        <div className="print-card">
          <div className="brand">
            <div className="brand-mark">🌸 Doreham / 도레함</div>
          </div>

          <h1 className="venue-name">{venue.business_name_display}</h1>

          <div className="qr-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImageUrl} alt="QR code" className="qr-image" />
          </div>

          <div className="code-text">{qr.code}</div>

          <div className="instructions">
            <p className="inst-title">
              {lang === 'ko' ? '📱 스캔 방법' : '📱 How to scan'}
            </p>
            <p className="inst-body">
              {lang === 'ko'
                ? 'Doreham 앱에서 매칭 상세 페이지의 "체크인" 버튼을 눌러 스캔하세요.'
                : 'Open Doreham → your match → tap "Check in" → scan this code.'}
            </p>
          </div>

          <div className="expiry">
            {lang === 'ko'
              ? `유효 기간: ${new Date(qr.valid_date).toLocaleDateString('ko-KR')} (하루)`
              : `Valid: ${new Date(qr.valid_date).toLocaleDateString('en-US')} (today only)`}
          </div>
        </div>

        <div className="tips no-print">
          <h3>{lang === 'ko' ? '💡 안내' : '💡 Tips'}</h3>
          <ul>
            <li>
              {lang === 'ko'
                ? 'QR 코드는 매일 새로 생성됩니다. 매장에 오늘의 QR을 인쇄해 두거나 화면에 띄워두세요.'
                : "A new QR is generated daily. Print today's copy or display it on a screen at the counter."}
            </li>
            <li>
              {lang === 'ko'
                ? '고객이 스캔하면 자동으로 체크인이 처리됩니다.'
                : 'When customers scan, check-in is automatic.'}
            </li>
            <li>
              {lang === 'ko'
                ? '스캔은 매칭 예약 시간 전후 40분~2시간 동안만 유효합니다.'
                : 'Scans work only within 40 min before to 2 hrs after the scheduled meetup time.'}
            </li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .qr-wrap { min-height: 100vh; background: var(--paper); }
        .qr-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .back-btn { text-decoration: none; color: var(--ink); font-size: 20px; }
        .header-title { font-family: var(--display); font-weight: 800; font-size: 17px; flex: 1; }
        .print-btn { background: var(--ink); color: var(--paper); border: 0; padding: 8px 16px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .content { max-width: 520px; margin: 0 auto; padding: 24px 20px; }
        .print-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 20px; padding: 36px 24px; text-align: center; }
        .brand { margin-bottom: 8px; }
        .brand-mark { font-family: var(--display); font-weight: 800; font-size: 14px; color: var(--persimmon); letter-spacing: 0.02em; }
        .venue-name { font-family: var(--display); font-weight: 800; font-size: 26px; color: var(--ink); margin: 8px 0 24px; }
        .qr-box { display: flex; justify-content: center; margin-bottom: 20px; }
        .qr-image { width: 300px; height: 300px; max-width: 80vw; max-height: 80vw; }
        .code-text { font-family: monospace; font-size: 24px; font-weight: 800; letter-spacing: 0.15em; color: var(--ink); margin: 8px 0 24px; padding: 8px 16px; background: var(--paper-2); border-radius: 8px; display: inline-block; }
        .instructions { text-align: left; padding: 16px; background: var(--paper-2); border-radius: 12px; margin-top: 12px; }
        .inst-title { margin: 0 0 6px; font-weight: 700; font-size: 14px; color: var(--ink); }
        .inst-body { margin: 0; font-size: 13px; color: var(--ink-60); line-height: 1.5; }
        .expiry { margin-top: 18px; font-size: 12px; color: var(--ink-60); font-weight: 500; }
        .tips { margin-top: 24px; background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px; }
        .tips h3 { font-family: var(--display); font-weight: 700; font-size: 15px; margin: 0 0 12px; color: var(--ink); }
        .tips ul { margin: 0; padding-left: 20px; }
        .tips li { font-size: 13px; color: var(--ink-60); line-height: 1.6; margin-bottom: 6px; }

        @media print {
          .no-print { display: none !important; }
          .qr-wrap { background: #fff; }
          .content { padding: 0; }
          .print-card { border: 0; box-shadow: none; padding: 40px 20px; }
        }
      `}</style>
    </main>
  );
}