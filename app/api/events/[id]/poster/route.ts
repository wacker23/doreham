import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { removePoster, setPoster } from '@/lib/server/events';

export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/** POST multipart/form-data { file } — set or replace the event's poster (host/admin). JPEG, PNG or WebP, ≤ 4 MB. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('poster_required', 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('poster_required', 400);
  const r = await setPoster(auth.user.id, id, file);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/** DELETE — remove the poster. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await removePoster(auth.user.id, id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
