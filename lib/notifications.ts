import { createClient } from '@supabase/supabase-js';

/**
 * Server-side helper to create notifications.
 * Called from other API routes (accept-match-invite, process-match-requests, etc.)
 * to create in-app notifications alongside emails.
 *
 * Usage:
 *   await createNotification({
 *     user_id: '...',
 *     type: 'match_invite',
 *     title_en: 'You have a new match!',
 *     title_ko: '새 매칭이 있어요!',
 *     body_en: 'A group is waiting for you to accept.',
 *     body_ko: '그룹에서 수락을 기다리고 있어요.',
 *     action_url: '/matches',
 *     is_important: true,
 *   });
 */

export type NotificationType =
  | 'match_invite'
  | 'match_activated'
  | 'match_cancelled'
  | 'availability_reminder'
  | 'check_in_reminder'
  | 'quest_day_reminder'
  | 'review_reminder'
  | 'strike_issued'
  | 'welcome';

export type NotificationPayload = {
  user_id: string;
  type: NotificationType;
  title_en: string;
  title_ko: string;
  body_en?: string;
  body_ko?: string;
  action_url?: string;
  is_important?: boolean;
};

export async function createNotification(payload: NotificationPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await admin.from('notifications').insert({
      user_id: payload.user_id,
      type: payload.type,
      title_en: payload.title_en,
      title_ko: payload.title_ko,
      body_en: payload.body_en ?? null,
      body_ko: payload.body_ko ?? null,
      action_url: payload.action_url ?? null,
      is_important: payload.is_important ?? false,
    });

    if (error) {
      console.error('createNotification failed:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    console.error('createNotification exception:', e);
    return { ok: false, error: e.message ?? 'Unknown' };
  }
}