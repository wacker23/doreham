import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

/**
 * POST /api/emails/welcome
 * body: { user_id: string }
 *
 * Sends welcome email after onboarding completes.
 */

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();
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
    const name = profile.display_name || (lang === 'ko' ? '친구' : 'friend');

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

    await resend.emails.send({
      from: 'Doreham / 도레함 <noreply@doreham.co.kr>',
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Welcome email failed:', e);
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}