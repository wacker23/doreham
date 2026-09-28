import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/**
 * GET  /api/notifications?limit=20
 *   The signed-in user's recent notifications (newest first) + unread_count.
 *
 * POST /api/notifications
 *   Body: { action: 'mark_read' | 'mark_all_read' | 'dismiss', notification_id? }
 */

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
  const admin = getAdmin();

  const [notifsRes, unreadRes] = await Promise.all([
    admin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('dismissed_at', null),
  ]);

  return NextResponse.json({
    notifications: notifsRes.data ?? [],
    unread_count: unreadRes.count ?? 0,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { action, notification_id } = await readJson<{ action: string; notification_id: string }>(request);
  const admin = getAdmin();
  const now = new Date().toISOString();

  if (action === 'mark_read') {
    if (!isUuid(notification_id)) return jsonError('notification_id required', 400);
    await admin
      .from('notifications')
      .update({ read_at: now })
      .eq('id', notification_id)
      .eq('user_id', userId)
      .is('read_at', null);
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark_all_read') {
    await admin
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('dismissed_at', null);
    return NextResponse.json({ ok: true });
  }

  if (action === 'dismiss') {
    if (!isUuid(notification_id)) return jsonError('notification_id required', 400);
    await admin
      .from('notifications')
      .update({ dismissed_at: now })
      .eq('id', notification_id)
      .eq('user_id', userId);
    return NextResponse.json({ ok: true });
  }

  return jsonError('Unknown action', 400);
}
