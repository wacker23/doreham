import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { recordVolunteerSignup } from '@/lib/server/volunteer';

/**
 * POST { group_id, action: 'registered' | 'no_spot' }
 *  registered — "I signed up on 1365"
 *  no_spot    — "I couldn't get a spot" → leaves the group with no strike
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { group_id, action } = await readJson<{ group_id: string; action: string }>(request);
  if (!isUuid(group_id)) return jsonError('group_id required', 400);
  if (action !== 'registered' && action !== 'no_spot') return jsonError('action must be registered or no_spot', 400);

  const result = await recordVolunteerSignup(auth.user.id, group_id, action);
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json(result);
}
