import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { redeemPerk } from '@/lib/server/perks';

/** POST — use a perk now (once a day). Returns what to show at the counter. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await redeemPerk(auth.user.id, id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
