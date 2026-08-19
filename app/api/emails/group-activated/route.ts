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

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, primary_language')
      .eq('id', user_id)
      .maybeSingle();

    const { data: userData } = await admin.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;

    if (!profile || !email) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const lang = profile.primary_language === 'ko' ? 'ko' : 'en';
    const names = (other_member_names ?? []).filter(Boolean).join(', ');

    const subject = lang === 'ko'
      ? `✨ ${profile.display_name}님, 매칭이 확정되었어요!`
      : `✨ Your match is confirmed!`;

    const html = lang === 'ko'
      ? `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">✨ 매칭 확정!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    안녕하세요 ${profile.display_name}님,<br><br>
    모든 멤버가 초대를 수락했어요. 이제 만날 시간을 정할 차례예요!
  </p>
  <div style="background: rgba(15, 157, 119, 0.08); border-radius: 12px; padding: 20px; margin: 24px 0;">
    ${names ? `<p style="margin: 0 0 8px; font-weight: 700;">👥 여러분의 그룹</p><p style="margin: 0 0 16px; color: #666;">${names}</p>` : ''}
    ${venue_name ? `<p style="margin: 0 0 8px; font-weight: 700;">📍 만날 장소</p><p style="margin: 0; color: #666;">${venue_name}</p>` : ''}
  </div>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    앱에서 <strong>가능한 시간</strong>을 선택해주세요. 모두가 선택하면 최적의 시간이 자동으로 결정돼요.
  </p>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #0F9D77; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    시간 선택하기 →
  </a>
  <p style="font-size: 12px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E1D8;">
    Doreham / 도레함 · 한국의 이민자를 위한 우정 앱
  </p>
</div>`
      : `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E2230;">
  <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px;">✨ Your match is confirmed!</h1>
  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${profile.display_name},<br><br>
    Everyone accepted the invite. Now it's time to figure out when to meet!
  </p>
  <div style="background: rgba(15, 157, 119, 0.08); border-radius: 12px; padding: 20px; margin: 24px 0;">
    ${names ? `<p style="margin: 0 0 8px; font-weight: 700;">👥 Your group</p><p style="margin: 0 0 16px; color: #666;">${names}</p>` : ''}
    ${venue_name ? `<p style="margin: 0 0 8px; font-weight: 700;">📍 Meeting spot</p><p style="margin: 0; color: #666;">${venue_name}</p>` : ''}
  </div>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    Head to the app and pick <strong>your availability</strong>. Once everyone picks, the best time gets locked in automatically.
  </p>
  <a href="${APP_URL}/matches" style="display: inline-block; background: #0F9D77; color: #fff; padding: 14px 32px; border-radius: 999px; font-weight: 700; text-decoration: none;">
    Pick availability →
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
    console.error('Group activated email failed:', e);
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}