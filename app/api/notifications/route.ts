import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET  /api/notifications?user_id=xxx&limit=20
 *   Returns recent notifications for user (default 20, newest first)
 *   Also returns unread_count
 *
 * POST /api/notifications
 *   Body: { action: 'mark_read' | 'mark_all_read' | 'dismiss', user_id, notification_id? }
 *   - mark_read: sets read_at on one notification
 *   - mark_all_read: sets read_at on all unread for user
 *   - dismiss: sets dismissed_at (removes from view entirely)
 */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, user_id, notification_id } = body;

    if (!action || !user_id) {
      return NextResponse.json({ error: 'action and user_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    if (action === 'mark_read') {
      if (!notification_id) return NextResponse.json({ error: 'notification_id required' }, { status: 400 });
      await admin
        .from('notifications')
        .update({ read_at: now })
        .eq('id', notification_id)
        .eq('user_id', user_id)
        .is('read_at', null);
      return NextResponse.json({ ok: true });
    }

    if (action === 'mark_all_read') {
      await admin
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', user_id)
        .is('read_at', null)
        .is('dismissed_at', null);
      return NextResponse.json({ ok: true });
    }

    if (action === 'dismiss') {
      if (!notification_id) return NextResponse.json({ error: 'notification_id required' }, { status: 400 });
      await admin
        .from('notifications')
        .update({ dismissed_at: now })
        .eq('id', notification_id)
        .eq('user_id', user_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}