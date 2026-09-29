import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { addComment, deleteComment } from '@/lib/server/events';

type Ctx = { params: Promise<{ id: string }> };

/** POST { body } — add a comment. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const { body } = await readJson<{ body?: string }>(request);
  const r = await addComment(auth.user.id, id, body ?? '');
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/** DELETE ?comment_id= — author, host or admin. */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const commentId = new URL(request.url).searchParams.get('comment_id') ?? '';
  if (!isUuid(commentId)) return jsonError('not_found', 404);
  const r = await deleteComment(auth.user.id, commentId);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
