import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotification } from '@/lib/notifications';
import { sendVenueWelcomeEmail, sendWelcomeEmail } from '@/lib/server/emails/welcome';

/**
 * POST /api/emails/welcome — called once when the signed-in user finishes onboarding (members),
 * or right after a venue owner signs up (venue accounts). Body (optional): { lang: 'en' | 'ko' }.
 * Creates the welcome notification and sends the welcome email. Idempotent per kind:
 * does nothing if that welcome was already sent.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  const admin = getAdmin();
  const body = (await request.json().catch(() => null)) as { lang?: string } | null;
  const lang = body?.lang === 'ko' || body?.lang === 'en' ? body.lang : null;

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, onboarding_completed, basic_signup_completed, account_type')
    .eq('id', userId)
    .maybeSingle();
  const venueOwner = profile?.account_type === 'venue' && !!profile.basic_signup_completed && !profile.onboarding_completed;
  if (!venueOwner && !profile?.onboarding_completed) return NextResponse.json({ ok: true, skipped: 'onboarding_incomplete' });

  // A venue owner who later makes a friend profile still gets the member welcome.
  const actionUrl = venueOwner ? '/venues/my' : '/matches';
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'welcome')
    .eq('action_url', actionUrl);
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: 'already_welcomed' });

  const name = profile?.display_name ?? '';
  if (venueOwner) {
    await createNotification({
      user_id: userId,
      type: 'welcome',
      title_en: `Welcome to Doreham${name ? `, ${name}` : ''}! 🏪`,
      title_ko: `도레함에 오신 것을 환영해요${name ? `, ${name}님` : ''}! 🏪`,
      body_en: 'Add your venue so people nearby can find it. Once it is approved, you can host events there.',
      body_ko: '가게를 등록하면 근처 사람들이 찾을 수 있어요. 승인되면 가게에서 이벤트도 열 수 있어요.',
      action_url: actionUrl,
    });
    const result = await sendVenueWelcomeEmail({ user_id: userId, lang: lang ?? 'ko' });
    if (result.error) console.error('Venue welcome email failed:', result.error);
    return NextResponse.json({ ok: true, email_sent: !result.error });
  }

  await createNotification({
    user_id: userId,
    type: 'welcome',
    title_en: `Welcome to Doreham${name ? `, ${name}` : ''}! 🌸`,
    title_ko: `도레함에 오신 것을 환영해요${name ? `, ${name}님` : ''}! 🌸`,
    body_en: "You're all set. Head to Matches to find your first group of friends.",
    body_ko: '준비 완료! 매칭 페이지에서 첫 그룹을 찾아보세요.',
    action_url: actionUrl,
  });

  const result = await sendWelcomeEmail({ user_id: userId });
  if (result.error) console.error('Welcome email failed:', result.error);
  return NextResponse.json({ ok: true, email_sent: !result.error });
}
