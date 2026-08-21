'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type QuestInfo = {
  quest_id: string;
  venue_id: string;
  venue_name: string;
  quest_scheduled_at: string | null;
  status: string;
  already_checked_in: boolean;
  check_in_count: number;
  total_members: number;
};

const CHECK_IN_WINDOW_BEFORE_MIN = 40;
const CHECK_IN_WINDOW_AFTER_MIN = 120;

export default function CheckInPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const params = useParams();
  const groupId = params?.group_id as string;

  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quest, setQuest] = useState<QuestInfo | null>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any | null>(null);

  const scannerRef = useRef<any>(null);

  useEffect(() => {
    setLang((document.body.dataset.lang as 'en' | 'ko') ?? 'en');
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push(`/sign-in?return=/matches/${groupId}/check-in`); return; }
    loadQuestInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, groupId]);

  async function loadQuestInfo() {
    setLoadingData(true);
    setError(null);

    // Verify membership
    const { data: mem } = await supabase
      .from('group_members')
      .select('user_id, invite_state, accepted_at, left_at')
      .eq('group_id', groupId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!mem || mem.left_at) {
      setError(lang === 'ko' ? '이 그룹의 멤버가 아니에요.' : "You're not a member of this group.");
      setLoadingData(false);
      return;
    }

    if (mem.invite_state !== 'accepted' && !mem.accepted_at) {
      setError(lang === 'ko' ? '먼저 초대를 수락하세요.' : 'You need to accept the invite first.');
      setLoadingData(false);
      return;
    }

    // Get quest
        // Get quest + group's scheduled time (quest_scheduled_at is on groups)
    const [{ data: q }, { data: gData }] = await Promise.all([
      supabase.from('quests').select('id, venue_id, status, venue:venues!inner(business_name_display)').eq('group_id', groupId).maybeSingle(),
      supabase.from('groups').select('quest_scheduled_at, phase').eq('id', groupId).maybeSingle(),
    ]);

    if (!q) {
      setError(lang === 'ko' ? '퀘스트를 찾을 수 없어요.' : 'No quest found.');
      setLoadingData(false);
      return;
    }

    // Get check-in stats
    const { count: checkInCount } = await supabase
      .from('quest_check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('quest_id', q.id);

    const { data: myCheckIn } = await supabase
      .from('quest_check_ins')
      .select('id')
      .eq('quest_id', q.id)
      .eq('user_id', user!.id)
      .maybeSingle();

    const { count: totalMembers } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .is('left_at', null);

        setQuest({
      quest_id: q.id,
      venue_id: q.venue_id,
      venue_name: (q.venue as any)?.business_name_display ?? '?',
      quest_scheduled_at: gData?.quest_scheduled_at ?? null,
      status: q.status,
      already_checked_in: !!myCheckIn,
      check_in_count: checkInCount ?? 0,
      total_members: totalMembers ?? 0,
    });
    setLoadingData(false);
  }

  useEffect(() => {
    // Auto-request GPS on mount
    requestGPS();
  }, []);

  async function requestGPS() {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('granted');
      },
      (err) => {
        console.warn('GPS denied:', err);
        setGpsStatus('denied');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  useEffect(() => {
    if (scanMode !== 'camera' || !quest || quest.already_checked_in) return;

    // Dynamically import html5-qrcode only in browser
    let mounted = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        const scanner = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // rear camera on mobile
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            // Successful scan
            submitCheckIn(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {}
        );
      } catch (e) {
        console.error('Scanner start failed:', e);
        setError(lang === 'ko' ? '카메라를 열 수 없어요.' : 'Camera unavailable.');
      }
    })();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, quest?.already_checked_in]);

  async function submitCheckIn(code: string) {
    if (submitting || !quest || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch('/api/quest-check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          group_id: groupId,
          qr_code: code,
          latitude: gpsCoords?.lat,
          longitude: gpsCoords?.lng,
        }),
      });
      const result = await resp.json();
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      setSuccess(result);
      setSubmitting(false);
    } catch (e: any) {
      setError(e.message ?? 'Check-in failed');
      setSubmitting(false);
    }
  }

  function computeWindowStatus() {
    if (!quest?.quest_scheduled_at) return { canCheckIn: false, message: '' };
    const scheduled = new Date(quest.quest_scheduled_at).getTime();
    const now = Date.now();
    const windowStart = scheduled - CHECK_IN_WINDOW_BEFORE_MIN * 60 * 1000;
    const windowEnd = scheduled + CHECK_IN_WINDOW_AFTER_MIN * 60 * 1000;
    if (now < windowStart) {
      const minsUntil = Math.ceil((windowStart - now) / 60000);
      const hours = Math.floor(minsUntil / 60);
      const mins = minsUntil % 60;
      const timeStr = hours > 0
        ? (lang === 'ko' ? `${hours}시간 ${mins}분` : `${hours}h ${mins}m`)
        : (lang === 'ko' ? `${mins}분` : `${mins} min`);
      return {
        canCheckIn: false,
        message: lang === 'ko' ? `체크인은 ${timeStr} 후에 열려요` : `Check-in opens in ${timeStr}`,
      };
    }
    if (now > windowEnd) {
      return {
        canCheckIn: false,
        message: lang === 'ko' ? '체크인 시간이 지났어요' : 'Check-in window has closed',
      };
    }
    return { canCheckIn: true, message: '' };
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

  if (error && !quest) {
    return (
      <main className="err-wrap">
        <div className="err-icon">⚠️</div>
        <h1>{lang === 'ko' ? '접근할 수 없어요' : 'Access denied'}</h1>
        <p>{error}</p>
        <a href="/matches" className="btn-back">{lang === 'ko' ? '매칭으로 돌아가기' : 'Back to matches'}</a>
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

  if (!quest) return null;

  const windowStatus = computeWindowStatus();

    // Success state
  if (success) {
    const windowEnd = success.window_ends_at ? new Date(success.window_ends_at) : null;
    const windowEndStr = windowEnd
      ? windowEnd.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    return (
      <main className="success-wrap">
        <div className="success-icon">✅</div>
        <h1>{lang === 'ko' ? '체크인 완료!' : 'Checked in!'}</h1>
        <p className="success-desc">
          {lang === 'ko'
            ? `${success.check_in_count}명 도착. 퀘스트는 체크인 시간이 끝나면 완료됩니다 (${windowEndStr}).`
            : `${success.check_in_count} of ${quest.total_members} checked in. Quest closes at ${windowEndStr}.`}
        </p>
        {success.location_verified && (
          <p className="verified-line">
            📍 {lang === 'ko' ? '위치 확인됨' : 'Location verified'}
          </p>
        )}
        <a href="/matches" className="btn-back">{lang === 'ko' ? '매칭으로 돌아가기' : 'Back to matches'}</a>
        <style jsx>{`
          .success-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; background: linear-gradient(180deg, rgba(15, 157, 119, 0.06), transparent); }
          .success-icon { font-size: 72px; margin-bottom: 16px; }
          h1 { font-family: var(--display); font-weight: 800; font-size: 28px; margin: 0 0 12px; color: var(--jade); }
          .success-desc { font-size: 16px; color: var(--ink); margin: 0 0 16px; max-width: 320px; line-height: 1.5; }
          .verified-line { font-size: 13px; color: var(--jade); margin: 0 0 32px; }
          .btn-back { background: var(--jade); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 999px; font-weight: 700; }
        `}</style>
      </main>
    );
  }

  // Already checked in state
  if (quest.already_checked_in) {
    return (
      <main className="checked-wrap">
        <div className="checked-icon">✅</div>
        <h1>{lang === 'ko' ? '이미 체크인했어요' : "You've already checked in"}</h1>
        <p>
          {lang === 'ko'
            ? `${quest.check_in_count} / ${quest.total_members}명 도착`
            : `${quest.check_in_count} of ${quest.total_members} checked in`}
        </p>
        <a href="/matches" className="btn-back">{lang === 'ko' ? '매칭으로 돌아가기' : 'Back to matches'}</a>
        <style jsx>{`
          .checked-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
          .checked-icon { font-size: 60px; margin-bottom: 16px; }
          h1 { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 8px; }
          p { color: var(--ink-60); margin: 0 0 24px; }
          .btn-back { background: var(--ink); color: var(--paper); text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="ci-wrap">
      <header className="ci-header">
        <a href="/matches" className="back-btn">←</a>
        <div className="header-title">{lang === 'ko' ? '체크인' : 'Check in'}</div>
      </header>

      <div className="content">
        <div className="venue-card">
          <div className="venue-label">{lang === 'ko' ? '📍 만나는 장소' : '📍 Meeting spot'}</div>
          <div className="venue-name">{quest.venue_name}</div>
          {quest.quest_scheduled_at && (
            <div className="quest-time">
              🗓️ {new Date(quest.quest_scheduled_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </div>
          )}
          <div className="checkin-progress">
            {lang === 'ko'
              ? `${quest.check_in_count} / ${quest.total_members}명 체크인`
              : `${quest.check_in_count} of ${quest.total_members} checked in`}
          </div>
        </div>

        {!windowStatus.canCheckIn && (
          <div className="window-banner">
            ⏱️ {windowStatus.message}
          </div>
        )}

        {windowStatus.canCheckIn && (
          <>
            {/* GPS status */}
            <div className={`gps-banner gps-${gpsStatus}`}>
              {gpsStatus === 'requesting' && `📡 ${lang === 'ko' ? '위치 확인 중...' : 'Getting your location...'}`}
              {gpsStatus === 'granted' && `✅ ${lang === 'ko' ? '위치 확인됨' : 'Location ready'}`}
              {gpsStatus === 'denied' && `⚠️ ${lang === 'ko' ? '위치 없이 진행 (검증 안 됨)' : 'Continuing without location (unverified)'}`}
              {gpsStatus === 'unavailable' && `⚠️ ${lang === 'ko' ? 'GPS 사용 불가' : 'GPS unavailable'}`}
            </div>

            {/* Mode toggle */}
            <div className="mode-toggle">
              <button
                className={scanMode === 'camera' ? 'active' : ''}
                onClick={() => setScanMode('camera')}
              >
                📷 {lang === 'ko' ? 'QR 스캔' : 'Scan QR'}
              </button>
              <button
                className={scanMode === 'manual' ? 'active' : ''}
                onClick={() => setScanMode('manual')}
              >
                ⌨️ {lang === 'ko' ? '코드 입력' : 'Enter code'}
              </button>
            </div>

            {/* Camera scanner */}
            {scanMode === 'camera' && (
              <div className="scanner-wrap">
                <div id="qr-scanner-container" className="scanner-box" />
                <p className="scanner-hint">
                  {lang === 'ko' ? '매장에 있는 QR 코드를 스캔하세요.' : 'Point your camera at the venue\'s QR code.'}
                </p>
              </div>
            )}

            {/* Manual input */}
            {scanMode === 'manual' && (
              <div className="manual-wrap">
                <label>{lang === 'ko' ? '매장 QR 코드' : 'Venue QR code'}</label>
                <input
                  type="text"
                  placeholder="ABCD-1234"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  maxLength={9}
                />
                <button
                  className="submit-btn"
                  disabled={submitting || !manualCode.trim()}
                  onClick={() => submitCheckIn(manualCode.trim())}
                >
                  {submitting
                    ? (lang === 'ko' ? '체크인 중...' : 'Checking in...')
                    : (lang === 'ko' ? '체크인' : 'Check in')}
                </button>
              </div>
            )}
          </>
        )}

        {error && <div className="error-banner">{error}</div>}
      </div>

      <style jsx>{`
        .ci-wrap { min-height: 100vh; background: var(--paper); }
        .ci-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .back-btn { text-decoration: none; color: var(--ink); font-size: 20px; }
        .header-title { font-family: var(--display); font-weight: 800; font-size: 17px; }
        .content { max-width: 480px; margin: 0 auto; padding: 20px; }
        .venue-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .venue-label { font-size: 12px; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .venue-name { font-family: var(--display); font-weight: 800; font-size: 22px; color: var(--ink); margin-bottom: 8px; }
        .quest-time { font-size: 14px; color: var(--ink-60); margin-bottom: 10px; }
        .checkin-progress { font-size: 13px; color: var(--jade); font-weight: 700; }
        .window-banner { background: rgba(255, 106, 61, 0.1); border: 1px solid rgba(255, 106, 61, 0.25); color: var(--persimmon); padding: 14px 18px; border-radius: 12px; font-weight: 600; text-align: center; margin-bottom: 16px; }
        .gps-banner { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
        .gps-requesting { background: #f5f2eb; color: var(--ink-60); }
        .gps-granted { background: rgba(15, 157, 119, 0.08); color: var(--jade); }
        .gps-denied, .gps-unavailable { background: rgba(232, 169, 63, 0.1); color: #a86720; }
        .mode-toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; margin-bottom: 16px; background: var(--paper-2); width: 100%; }
        .mode-toggle button { flex: 1; border: 0; background: transparent; padding: 12px 16px; font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; color: var(--ink-60); }
        .mode-toggle button.active { background: var(--ink); color: var(--paper); }
        .scanner-wrap { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 16px; }
        .scanner-box { width: 100%; min-height: 280px; background: #000; border-radius: 12px; overflow: hidden; }
        .scanner-hint { font-size: 13px; color: var(--ink-60); text-align: center; margin: 12px 0 0; }
        .manual-wrap { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px; }
        .manual-wrap label { display: block; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
        .manual-wrap input { width: 100%; padding: 14px 16px; border: 2px solid var(--ink-12); border-radius: 10px; font-family: monospace; font-size: 20px; font-weight: 700; text-align: center; letter-spacing: 0.1em; outline: none; margin-bottom: 12px; box-sizing: border-box; }
        .manual-wrap input:focus { border-color: var(--persimmon); }
        .submit-btn { width: 100%; background: var(--persimmon); color: #fff; border: 0; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-banner { background: rgba(255, 106, 61, 0.1); border: 1px solid rgba(255, 106, 61, 0.25); color: var(--persimmon); padding: 12px 16px; border-radius: 12px; margin-top: 12px; font-size: 14px; }
      `}</style>
    </main>
  );
}