import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { setGoing } from '@/lib/server/events';

/** POST { going: boolean } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const { going } = await readJson<{ going?: boolean }>(request);
  const r = await setGoing(auth.user.id, id, going !== false);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
