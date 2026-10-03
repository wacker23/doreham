import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { sendPush, type PushMessage } from '@/lib/server/push';

const PREVIEW_CHARS = 140;

export function previewText(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_CHARS ? `${oneLine.slice(0, PREVIEW_CHARS - 1)}…` : oneLine;
}

/**
 * Push a new chat message to everyone else in the group (accepted, not left).
 * Chat messages are not saved to the notification bell; they only go to devices.
 * One notification per chat: a newer message replaces the older one (tag).
 */
export async function pushChatMessage(groupId: string, senderId: string, content: string): Promise<void> {
  try {
    const admin = getAdmin();
    const [{ data: members }, { data: sender }] = await Promise.all([
      admin.from('group_members').select('user_id, accepted_at, left_at').eq('group_id', groupId),
      admin.from('profiles').select('display_name').eq('id', senderId).maybeSingle(),
    ]);
    const recipients = ((members ?? []) as { user_id: string; accepted_at: string | null; left_at: string | null }[])
      .filter((m) => m.user_id !== senderId && m.accepted_at && !m.left_at)
      .map((m) => m.user_id);
    if (recipients.length === 0) return;

    const name = (sender as { display_name?: string | null } | null)?.display_name?.trim() || null;
    const body = previewText(content);
    const messages: PushMessage[] = recipients.map((user_id) => ({
      user_id,
      type: 'chat_message',
      title_en: `${name ?? 'New message'} · Group chat`,
      title_ko: `${name ?? '새 메시지'} · 그룹 채팅`,
      body_en: body,
      body_ko: body,
      action_url: `/matches/${groupId}/chat`,
      tag: `chat-${groupId}`,
      urgency: 'high',
    }));
    await sendPush(messages);
  } catch (e) {
    console.error('pushChatMessage failed:', e instanceof Error ? e.message : e);
  }
}
