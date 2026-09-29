import { NextResponse } from 'next/server';
import { jsonError, readJson, requireUser } from '@/lib/server/auth';
import { grantConsent, listConsents, withdrawConsent, type ConsentKind } from '@/lib/server/consents';

const KINDS: ConsentKind[] = ['volunteer_photos'];

/** GET — the signed-in user's active consents. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ consents: await listConsents(auth.user.id) });
}

/** POST { kind, action: 'grant' | 'withdraw' } */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await readJson<{ kind?: string; action?: string }>(request);
  const kind = KINDS.find((k) => k === body.kind);
  const action = body.action;
  if (!kind) return jsonError('unknown_consent', 400);

  if (action === 'grant') {
    const r = await grantConsent(auth.user.id, kind);
    return r.ok ? NextResponse.json({ ok: true }) : jsonError(r.error, 500);
  }
  if (action === 'withdraw') {
    const r = await withdrawConsent(auth.user.id, kind);
    return r.ok ? NextResponse.json({ ok: true }) : jsonError(r.error, 409);
  }
  return jsonError('unknown_action', 400);
}
