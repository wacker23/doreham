import { NextResponse } from 'next/server';
import { jsonError, readJson, requireUser } from '@/lib/server/auth';
import { deleteAccount } from '@/lib/server/account';

/** DELETE — delete the signed-in account for good. Body: { confirm: true }. */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { confirm } = await readJson<{ confirm: boolean }>(request);
  if (confirm !== true) return jsonError('confirm_required', 400);
  const r = await deleteAccount(auth.user.id);
  if (!r.ok) return jsonError(r.error, r.status);
  return NextResponse.json({ ok: true });
}
