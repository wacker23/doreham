import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

/**
 * POST /api/emails/strike-issued
 * body: {
 *   user_id: string,
 *   reason: 'cancelled_match' | 'no_show' | 'reported_behavior',
 *   strike_number: number,
 *   freeze_until: string | null,
 * }
 */

const REASON_LABELS: Record<string, { en: string; ko: string }> = {
  cancelled_match: {
    en: 'You cancelled a match after the availability phase started.',
    ko: '가능한 시간 단계 이후에 매칭을 취소하셨습니다.',
  },
  no_show: {
    en: "You didn't check in at the meetup.",
    ko: '만남에 체크인하지 않으셨습니다.',
  },
  reported_behavior: {
    en: 'A report about your behavior was verified.',
    ko: '행동에 대한 신고가 확인되었습니다.',
  },
};

export async function POST(request: Request) {
  try {
    const { user_id, reason, strike_number, freeze_until } = await request.json();
    if (!user_id || !reason || !strike_number) {
      return NextResponse.json({ error: 'user_id, reason, strike_number required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, primary_language')
      .eq('id', user_id)
      .maybeSingle();

    const { data: userData } = await admin.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;

    if (!profile || !email) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const lang = profile.primary_language === 'ko' ? 'ko' : 'en';
    const name = profile.display_name || (lang === 'ko' ? '친구' : 'friend');
    const reasonLabel = REASON_LABELS[reason]?.[lang] || reason;

    let freezeText = '';
    if (freeze_until) {
      const until = new Date(freeze_until);
      const dateStr = until.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      freezeText = lang === 'ko'
        ? `계정이 <strong>${dateStr}</strong>까지 일시 정지됩니다. 그 이후 다시 매칭할 수 있어요.`
        : `Your account is frozen until <strong>${dateStr}</strong>. You can match again after that.`;
    }

    const subject = lang === 'ko'
      ? `⚠️ 경고 ${strike_number}단계가 발생했어요`
      : `⚠️ You received strike ${strike_number}`;

    const html = lang === 'ko' ? `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">⚠️ 경고 알림</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    안녕하세요 ${name}님,<br><br>
    도레함 커뮤니티 정책에 따라 경고를 받으셨습니다.
  </p>
  <div style="background: rgba(232, 169, 63, 0.1); border-left: 3px solid #E8A93F; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 14px; color: #a86720;">사유</p>
    <p style="margin: 0 0 12px; color: #333;">${reasonLabel}</p>
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 14px; color: #a86720;">경고 단계</p>
    <p style="margin: 0; color: #333;"><strong>${strike_number}번째 경고</strong></p>
  </div>
  ${freezeText ? `<p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${freezeText}</p>` : ''}
  <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 24px;">
    💡 <strong>4단계 시스템:</strong><br>
    1단계: 주의 안내 · 2단계: 주의 · 3단계: 48시간 정지 · 4단계+: 1주일 정지
  </p>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    매칭 페이지로 →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · 한국의 이민자를 위한 우정 앱
  </p>
</div>` : `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">⚠️ Strike notification</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${name},<br><br>
    You received a strike under our community policy.
  </p>
  <div style="background: rgba(232, 169, 63, 0.1); border-left: 3px solid #E8A93F; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 14px; color: #a86720;">Reason</p>
    <p style="margin: 0 0 12px; color: #333;">${reasonLabel}</p>
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 14px; color: #a86720;">Strike level</p>
    <p style="margin: 0; color: #333;"><strong>Strike #${strike_number}</strong></p>
  </div>
  ${freezeText ? `<p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${freezeText}</p>` : ''}
  <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 24px;">
    💡 <strong>4-tier system:</strong><br>
    Strike 1: Warning · Strike 2: Notice · Strike 3: 48h freeze · Strike 4+: 1-week freeze
  </p>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    Back to matches →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · Friendship app for immigrants in Korea
  </p>
</div>`;

    await resend.emails.send({
      from: 'Doreham / 도레함 <noreply@doreham.co.kr>',
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Strike email failed:', e);
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}