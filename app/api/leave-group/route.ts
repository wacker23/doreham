import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { leaveGroup } from '@/lib/server/groupLifecycle';

/**
 * POST { group_id } — the signed-in user leaves a group they accepted.
 * Leaving a confirmed group (availability / voting / scheduled) issues a strike.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { group_id } = await readJson<{ group_id: string }>(request);
  if (!isUuid(group_id)) return jsonError('group_id required', 400);

  const result = await leaveGroup(auth.user.id, group_id);
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json(result);
}
