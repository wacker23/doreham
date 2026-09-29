import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Server-side helper to create in-app notifications (service role).
 * Every user-facing string is bilingual (KO + EN).
 */

export type NotificationType =
  | 'match_invite'
  | 'match_found'
  | 'match_activated'
  | 'match_cancelled'
  | 'no_match_found'
  | 'member_left'
  | 'quest_scheduled'
  | 'availability_reminder'
  | 'check_in_reminder'
  | 'quest_day_reminder'
  | 'review_reminder'
  | 'strike_issued'
  | 'welcome'
  | 'event_joined'
  | 'event_comment'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_reminder';

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

function toRow(p: NotificationPayload) {
  return {
    user_id: p.user_id,
    type: p.type,
    title_en: p.title_en,
    title_ko: p.title_ko,
    body_en: p.body_en ?? null,
    body_ko: p.body_ko ?? null,
    action_url: p.action_url ?? null,
    is_important: p.is_important ?? false,
  };
}

export async function createNotification(payload: NotificationPayload): Promise<{ ok: boolean; error?: string }> {
  return createNotifications([payload]);
}

export async function createNotifications(payloads: NotificationPayload[]): Promise<{ ok: boolean; error?: string }> {
  if (payloads.length === 0) return { ok: true };
  try {
    const { error } = await getAdmin().from('notifications').insert(payloads.map(toRow));
    if (error) {
      console.error('createNotifications failed:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    console.error('createNotifications exception:', msg);
    return { ok: false, error: msg };
  }
}
