import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { recordVolunteerProof } from '@/lib/server/volunteer';

export const maxDuration = 30;

/**
 * POST multipart/form-data
 *   group_id         uuid
 *   kind             'group_selfie' (required to complete the quest) | 'certificate' (optional)
 *   file             image (selfie) or image/PDF (certificate), ≤ 10 MB
 *   tagged_user_ids  JSON array of member ids in the selfie (uploader is always included)
 *   latitude/longitude optional
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('multipart form required', 400);
  }

  const groupId = String(form.get('group_id') ?? '');
  const kind = String(form.get('kind') ?? '');
  const file = form.get('file');
  if (!isUuid(groupId)) return jsonError('group_id required', 400);
  if (kind !== 'group_selfie' && kind !== 'certificate') return jsonError('kind must be group_selfie or certificate', 400);
  if (!(file instanceof File) || file.size === 0) return jsonError('file required', 400);

  let tagged: string[] = [];
  try {
    const raw = JSON.parse(String(form.get('tagged_user_ids') ?? '[]'));
    if (Array.isArray(raw)) tagged = raw.filter(isUuid);
  } catch {
    tagged = [];
  }
  const lat = Number(form.get('latitude'));
  const lng = Number(form.get('longitude'));

  const result = await recordVolunteerProof({
    userId: auth.user.id,
    groupId,
    kind,
    file,
    taggedUserIds: tagged,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json(result);
}
