import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotification } from '@/lib/notifications';
import { sendWelcomeEmail } from '@/lib/server/emails/welcome';

/**
 * POST /api/emails/welcome — called once when the signed-in user finishes onboarding.
 * Creates the welcome notification and sends the welcome email. Idempotent:
 * does nothing if the user already has a welcome notification.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  const admin = getAdmin();

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.onboarding_completed) return NextResponse.json({ ok: true, skipped: 'onboarding_incomplete' });

  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'welcome');
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: 'already_welcomed' });

  const name = profile.display_name ?? '';
  await createNotification({
    user_id: userId,
    type: 'welcome',
    title_en: `Welcome to Doreham${name ? `, ${name}` : ''}! 🌸`,
    title_ko: `도레함에 오신 것을 환영해요${name ? `, ${name}님` : ''}! 🌸`,
    body_en: "You're all set. Head to Matches to find your first group of friends.",
    body_ko: '준비 완료! 매칭 페이지에서 첫 그룹을 찾아보세요.',
    action_url: '/matches',
  });

  const result = await sendWelcomeEmail({ user_id: userId });
  if (result.error) console.error('Welcome email failed:', result.error);
  return NextResponse.json({ ok: true, email_sent: !result.error });
}
