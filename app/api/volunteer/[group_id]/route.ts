import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { getVolunteerQuestView } from '@/lib/server/volunteer';

/** GET — everything the volunteer quest page needs (programs, votes, signup status, proofs with signed URLs). */
export async function GET(_request: Request, { params }: { params: Promise<{ group_id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { group_id } = await params;
  if (!isUuid(group_id)) return jsonError('group_id required', 400);

  const view = await getVolunteerQuestView(auth.user.id, group_id);
  if (!view.ok) return jsonError(view.error, view.status);
  return NextResponse.json(view);
}
