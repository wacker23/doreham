// Server-only. Moved from app/api/emails/quest-day-reminder/route.ts (Sep 28 2026) so it is
// called directly instead of via an unauthenticated internal HTTP endpoint.
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { getResend, EMAIL_FROM_BRANDED, APP_URL, emailResult, escapeHtml, cleanSubject, type EmailResult } from '@/lib/server/emails/common';

/**
 * Server helper (formerly POST /api/emails/quest-day-reminder)
 * body: { user_id, venue_name, scheduled_at }
 */

export async function sendQuestDayReminderEmail(params: { user_id: string; venue_name: string; scheduled_at: string }): Promise<EmailResult> {
  try {
    const { user_id, venue_name, scheduled_at } = params;
    if (!user_id || !venue_name || !scheduled_at) {
      return emailResult({ error: 'user_id, venue_name, scheduled_at required' }, { status: 400 });
    }

    const admin = getAdmin();

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, primary_language')
      .eq('id', user_id)
      .maybeSingle();

    const { data: userData } = await admin.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;

    if (!profile || !email) return emailResult({ error: 'User not found' }, { status: 404 });

    const lang = profile.primary_language === 'ko' ? 'ko' : 'en';
    const name = escapeHtml(profile.display_name || (lang === 'ko' ? '친구' : 'friend'));
    const venueName = escapeHtml(venue_name);

    const scheduledDate = new Date(scheduled_at);
    const timeEn = scheduledDate.toLocaleString('en-US', {
      weekday: 'long', hour: 'numeric', minute: '2-digit',
    });
    const timeKo = scheduledDate.toLocaleString('ko-KR', {
      weekday: 'long', hour: 'numeric', minute: '2-digit',
    });

    const subject = lang === 'ko'
      ? `🗓️ 오늘 ${venue_name}에서 만나요!`
      : `🗓️ Your meetup at ${venue_name} is today!`;

    const html = lang === 'ko' ? `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 16px;">🗓️ 오늘이에요!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    안녕하세요 ${name}님,<br><br>
    오늘 만남이 있어요!
  </p>
  <div style="background: rgba(255, 106, 61, 0.06); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 15px;">📍 장소</p>
    <p style="margin: 0 0 16px; color: #666; font-size: 15px;">${venueName}</p>
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 15px;">🕐 시간</p>
    <p style="margin: 0; color: #666; font-size: 15px;">${timeKo}</p>
  </div>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    매칭 페이지 열기 →
  </a>
  <p style="font-size: 13px; color: #666; margin-top: 24px;">
    💡 도착하면 매장의 QR 코드를 스캔해서 체크인하세요.
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · 한국의 이민자를 위한 우정 앱
  </p>
</div>` : `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 16px;">🗓️ It's today!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${name},<br><br>
    Your meetup is happening today!
  </p>
  <div style="background: rgba(255, 106, 61, 0.06); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 15px;">📍 Where</p>
    <p style="margin: 0 0 16px; color: #666; font-size: 15px;">${venueName}</p>
    <p style="margin: 0 0 8px; font-weight: 700; font-size: 15px;">🕐 When</p>
    <p style="margin: 0; color: #666; font-size: 15px;">${timeEn}</p>
  </div>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    Open matches →
  </a>
  <p style="font-size: 13px; color: #666; margin-top: 24px;">
    💡 When you arrive, scan the venue's QR code to check in.
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · Friendship app for immigrants in Korea
  </p>
</div>`;

    const sent = await getResend().emails.send({
      from: EMAIL_FROM_BRANDED,
      to: email,
      subject: cleanSubject(subject),
      html,
    });
    if (sent.error) return emailResult({ error: sent.error.message }, { status: 502 });

    return emailResult({ ok: true });
  } catch (e: any) {
    console.error('Quest-day email failed:', e);
    return emailResult({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}