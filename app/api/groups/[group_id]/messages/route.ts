import { NextResponse, after } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { pushChatMessage } from '@/lib/server/chatPush';

const MESSAGE_COLUMNS = 'id, group_id, sender_id, content, message_type, is_hidden, created_at, edited_at, reply_to_id';

/**
 * POST { content, reply_to_id? } — send a chat message.
 * The insert runs with the member's own session, so the same database rules as before
 * apply (only accepted, current members can post). Then the other members get a push.
 */
export async function POST(request: Request, { params }: { params: Promise<{ group_id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { group_id: groupId } = await params;
  if (!isUuid(groupId)) return jsonError('bad_group', 400);

  const body = await readJson<{ content?: unknown; reply_to_id?: unknown }>(request);
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) return jsonError('empty', 400);
  if (content.length > 2000) return jsonError('too_long', 400);
  const replyTo = body.reply_to_id == null ? null : isUuid(body.reply_to_id) ? body.reply_to_id : undefined;
  if (replyTo === undefined) return jsonError('bad_reply', 400);

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ group_id: groupId, sender_id: auth.user.id, content, message_type: 'user_text', reply_to_id: replyTo })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) {
    // RLS refusal = not a current member of this group
    const denied = error?.code === '42501' || /row-level security/i.test(error?.message ?? '');
    return jsonError(denied ? 'not_a_member' : 'send_failed', denied ? 403 : 500);
  }

  after(() => pushChatMessage(groupId, auth.user.id, content));
  return NextResponse.json({ message: data });
}
