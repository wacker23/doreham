import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { createPerk, deletePerk, updatePerk, venuePerksForOwner } from '@/lib/server/perks';

type Ctx = { params: Promise<{ venue_id: string }> };

/** GET — the owner's perks for this venue, today's code and how often each was used. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { venue_id } = await params;
  if (!isUuid(venue_id)) return jsonError('not_found', 404);
  const r = await venuePerksForOwner(auth.user.id, venue_id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/** POST { title, details?, min_level } — add a perk. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { venue_id } = await params;
  if (!isUuid(venue_id)) return jsonError('not_found', 404);
  const r = await createPerk(auth.user.id, venue_id, await readJson(request));
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/** PATCH { perk_id, title?, details?, min_level?, is_active? } */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { venue_id } = await params;
  const body = await readJson<{ perk_id?: string; title?: string; details?: string | null; min_level?: number; is_active?: boolean }>(request);
  if (!isUuid(venue_id) || !isUuid(body.perk_id)) return jsonError('not_found', 404);
  const r = await updatePerk(auth.user.id, venue_id, body.perk_id, body);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/** DELETE ?perk_id= */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { venue_id } = await params;
  const perkId = new URL(request.url).searchParams.get('perk_id');
  if (!isUuid(venue_id) || !isUuid(perkId)) return jsonError('not_found', 404);
  const r = await deletePerk(auth.user.id, venue_id, perkId);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
