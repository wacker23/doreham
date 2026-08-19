import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

export async function POST(request: Request) {
  try {
    const { user_id, group_id, venue_name, other_member_names } = await request.json();
    if (!user_id || !group_id) {
      return NextResponse.json({ error: 'user_id and group_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get invitee profile + auth email
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, primary_language')
      .eq('id', user_id)
      .maybeSingle();

    const { data: userData } = await admin.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;

    if (!profile || !email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const lang = profile.primary_language === 'ko' ? 'ko' : 'en';
    const names = (other_member_names ?? []).filter(Boolean).join(', ');

    const subject = lang === 'ko'
      ? `🎉 ${profile.display_name}님, 새로운 매칭에 초대되었어요!`
      : `🎉 You've been invited to a new match on Doreham!`;

    const html = lang === 'ko'
      ? `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">🎉 매칭 초대!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    안녕하세요 ${profile.display_name}님,<br><br>
    Doreham에서 새로운 매칭에 초대되었어요.
  </p>
  <div style="background: #F5F2EB; border-radius: 12px; padding: 20px; margin: 24px 0;">
    ${names ? `<p style="margin: 0 0 8px; font-weight: 700;">👥 함께할 멤버</p><p style="margin: 0 0 16px; color: #666;">${names}</p>` : ''}
    ${venue_name ? `<p style="margin: 0 0 8px; font-weight: 700;">📍 만날 장소</p><p style="margin: 0; color: #666;">${venue_name}</p>` : ''}
  </div>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    24시간 안에 수락 또는 거절해주세요. 시간이 지나면 초대가 만료됩니다.
  </p>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    지금 확인하기 →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · 한국의 이민자를 위한 우정 앱<br>
    <a href="${APP_URL}/settings/notifications" style="color: #999;">알림 설정</a>
  </p>
</div>`
      : `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">🎉 You've been invited!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${profile.display_name},<br><br>
    You've been invited to join a new match on Doreham.
  </p>
  <div style="background: #F5F2EB; border-radius: 12px; padding: 20px; margin: 24px 0;">
    ${names ? `<p style="margin: 0 0 8px; font-weight: 700;">👥 Your group</p><p style="margin: 0 0 16px; color: #666;">${names}</p>` : ''}
    ${venue_name ? `<p style="margin: 0 0 8px; font-weight: 700;">📍 Meeting spot</p><p style="margin: 0; color: #666;">${venue_name}</p>` : ''}
  </div>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    Please accept or decline within 24 hours. Invites expire after that.
  </p>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #FF6A3D; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    View invite →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · Friendship app for immigrants in Korea<br>
    <a href="${APP_URL}/settings/notifications" style="color: #999;">Notification settings</a>
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
    console.error('Match invite email failed:', e);
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}