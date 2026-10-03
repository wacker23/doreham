import { NextResponse } from 'next/server';
import { isAdminUser, isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { profileSummary } from '@/lib/server/points';

/**
 * GET — level, points and earned badges shown on a profile.
 * Same visibility as the profile itself: yourself, an admin, or someone you share a group with
 * (a declined invite doesn't count). Deleted accounts are not found.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);

  const admin = getAdmin();
  const { data: target } = await admin.from('profiles').select('deleted_at').eq('id', id).maybeSingle();
  if (!target || target.deleted_at) return jsonError('not_found', 404);

  if (id !== auth.user.id && !(await isAdminUser(auth.user.id))) {
    const { data: rows } = await admin
      .from('group_members')
      .select('group_id, user_id')
      .in('user_id', [auth.user.id, id])
      .is('declined_at', null);
    const mine = new Set((rows ?? []).filter((r) => r.user_id === auth.user.id).map((r) => r.group_id as string));
    const shared = (rows ?? []).some((r) => r.user_id === id && mine.has(r.group_id as string));
    if (!shared) return jsonError('not_found', 404);
  }

  return NextResponse.json(await profileSummary(id));
}
