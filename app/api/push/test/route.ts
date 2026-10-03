import { NextResponse } from 'next/server';
import { jsonError, requireUser } from '@/lib/server/auth';
import { pushConfigured, sendPush } from '@/lib/server/push';

/** POST — send a test push to all of the signed-in user's devices (not saved as a notification). */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!pushConfigured()) return jsonError('push_not_configured', 503);
  const r = await sendPush([
    {
      user_id: auth.user.id,
      type: 'test',
      title_en: 'Notifications are on',
      title_ko: '알림이 켜졌어요',
      body_en: "This is how Doreham will reach you when something happens.",
      body_ko: '새 소식이 있으면 이렇게 알려드릴게요.',
      action_url: '/matches',
    },
  ]);
  if (r.sent === 0) return jsonError('no_device', 404, r);
  return NextResponse.json({ ok: true, ...r });
}
