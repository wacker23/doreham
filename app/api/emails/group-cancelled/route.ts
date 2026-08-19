import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

export async function POST(request: Request) {
  try {
    const { user_id, reason, will_retry } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
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

    const subject = lang === 'ko'
      ? `😔 매칭이 성사되지 않았어요`
      : `😔 Your match didn't work out`;

    const retryText = will_retry
      ? (lang === 'ko' ? '새로운 후보를 다시 찾고 있어요.' : "We're looking for new candidates.")
      : (lang === 'ko' ? '다시 매칭을 요청해보세요.' : 'Try requesting a new match.');

    const html = lang === 'ko'
      ? `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">😔 매칭이 성사되지 않았어요</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    안녕하세요 ${profile.display_name}님,<br><br>
    아쉽게도 이번 매칭이 성사되지 않았어요.
    ${reason ? `<br><br><em style="color: #666;">사유: ${reason}</em>` : ''}
  </p>
  <div style="background: rgba(255, 106, 61, 0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">${retryText}</p>
  </div>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    앱으로 이동 →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · 한국의 이민자를 위한 우정 앱
  </p>
</div>`
      : `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">😔 Your match didn't work out</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${profile.display_name},<br><br>
    Unfortunately your match fell through.
    ${reason ? `<br><br><em style="color: #666;">Reason: ${reason}</em>` : ''}
  </p>
  <div style="background: rgba(255, 106, 61, 0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0; font-size: 15px; line-height: 1.6;">${retryText}</p>
  </div>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    Open Doreham →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
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
    console.error('Group cancelled email failed:', e);
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}