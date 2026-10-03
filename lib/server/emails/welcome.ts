// Server-only. Moved from app/api/emails/welcome/route.ts (Sep 28 2026) so it is
// called directly instead of via an unauthenticated internal HTTP endpoint.
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { getResend, EMAIL_FROM_BRANDED, APP_URL, emailResult, escapeHtml, cleanSubject, type EmailResult } from '@/lib/server/emails/common';

/**
 * Server helper (formerly POST /api/emails/welcome)
 * body: { user_id: string }
 *
 * Sends welcome email after onboarding completes.
 */

export async function sendWelcomeEmail(params: { user_id: string }): Promise<EmailResult> {
  try {
    const { user_id } = params;
    if (!user_id) {
      return emailResult({ error: 'user_id required' }, { status: 400 });
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

    const subject = lang === 'ko'
      ? `🌸 도레함에 오신 것을 환영해요, ${name}님!`
      : `🌸 Welcome to Doreham, ${name}!`;

    const html = lang === 'ko'
      ? `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 16px;">🌸 환영합니다!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    안녕하세요 ${name}님,<br><br>
    도레함에 가입해 주셔서 감사합니다. 도레함은 한국에서 외국인들이 진정한 친구를 만들 수 있도록 돕는 앱입니다.
  </p>
  <div style="background: rgba(255, 106, 61, 0.06); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 12px; font-weight: 700; font-size: 15px;">✨ 다음 단계</p>
    <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
      <li>매칭 페이지에서 도시와 그룹 크기 선택</li>
      <li>알고리즘이 성격과 관심사가 맞는 사람들을 찾아드려요</li>
      <li>초대를 수락하고, 만날 시간을 정하고, 실제로 만나요!</li>
    </ol>
  </div>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    첫 매칭 시작하기 →
  </a>
  <p style="font-size: 13px; color: #666; margin-top: 32px; line-height: 1.6;">
    도로 (분홍)와 하미 (라벤더)가 함께해요! 💗
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · 한국의 이민자를 위한 우정 앱
  </p>
</div>`
      : `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 16px;">🌸 Welcome to Doreham!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${name},<br><br>
    Thanks for joining Doreham. We help internationals in Korea build real friendships — matched by personality, interests, and city.
  </p>
  <div style="background: rgba(255, 106, 61, 0.06); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 12px; font-weight: 700; font-size: 15px;">✨ What's next</p>
    <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
      <li>Head to Matches, pick your city and group size</li>
      <li>Our algorithm finds people whose personality and interests fit yours</li>
      <li>Accept the invite, pick a time, and meet in real life!</li>
    </ol>
  </div>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    Find your first match →
  </a>
  <p style="font-size: 13px; color: #666; margin-top: 32px; line-height: 1.6;">
    Doro (pink) and Hami (lavender) are with you every step of the way! 💗
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
    console.error('Welcome email failed:', e);
    return emailResult({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}
/** Venue owners who signed up without a friend profile: how to get their place listed. */
export async function sendVenueWelcomeEmail(params: { user_id: string; lang: 'en' | 'ko' }): Promise<EmailResult> {
  try {
    const { user_id, lang } = params;
    const admin = getAdmin();
    const [{ data: profile }, { data: userData }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('id', user_id).maybeSingle(),
      admin.auth.admin.getUserById(user_id),
    ]);
    const email = userData?.user?.email;
    if (!profile || !email) return emailResult({ error: 'User not found' }, { status: 404 });

    const ko = lang === 'ko';
    const name = escapeHtml(profile.display_name || (ko ? '사장님' : 'there'));
    const subject = ko ? `🏪 도레함에 오신 것을 환영해요, ${profile.display_name || '사장님'}!` : `🏪 Welcome to Doreham, ${profile.display_name || 'there'}!`;
    const steps = ko
      ? ['가게 정보 입력: 사진, 영업시간, 메뉴 (5분 정도)', '도레함이 확인하고 승인 결과를 알려드려요', '승인되면 매칭된 그룹이 찾아오고, 가게에서 이벤트도 열 수 있어요']
      : ['Add your venue: photos, opening hours, menu (about 5 minutes)', 'Doreham checks it and lets you know when it is approved', 'Once approved, matched groups can visit and you can host events at your place'];

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 16px;">🏪 ${ko ? '환영합니다!' : 'Welcome to Doreham!'}</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    ${ko ? `안녕하세요 ${name}님,<br><br>도레함에 가입해 주셔서 감사합니다. 도레함은 한국에 사는 외국인들이 소그룹으로 만나 친구가 되도록 돕고, 좋은 동네 가게를 소개해요.` : `Hi ${name},<br><br>Thanks for joining Doreham. We help internationals in Korea make friends in small groups, and we introduce them to good local places like yours.`}
  </p>
  <div style="background: rgba(15, 157, 119, 0.07); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 12px; font-weight: 700; font-size: 15px;">✨ ${ko ? '다음 단계' : "What's next"}</p>
    <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
      ${steps.map((s) => `<li>${s}</li>`).join('\n      ')}
    </ol>
  </div>
  <a href="${APP_URL}/venues/my" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    ${ko ? '내 가게로 가기 →' : 'Go to my venues →'}
  </a>
  <p style="font-size: 13px; color: #666; margin-top: 32px; line-height: 1.6;">
    ${ko ? '사람들도 만나 보고 싶으시면, 언제든 앱에서 친구 프로필을 만들 수 있어요.' : 'Want to meet people too? You can make a friend profile in the app any time.'}
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · ${ko ? '한국의 이민자를 위한 우정 앱' : 'Friendship app for immigrants in Korea'}
  </p>
</div>`;

    const sent = await getResend().emails.send({ from: EMAIL_FROM_BRANDED, to: email, subject: cleanSubject(subject), html });
    if (sent.error) return emailResult({ error: sent.error.message }, { status: 502 });
    return emailResult({ ok: true });
  } catch (e: unknown) {
    console.error('Venue welcome email failed:', e);
    return emailResult({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
