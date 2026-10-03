import { NextResponse } from 'next/server';
import { isAdminUser, isUuid, jsonError, publicError, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { kstDateString } from '@/lib/server/time';
import { randomInt } from 'crypto';
import QRCode from 'qrcode';


/**
 * GET /api/venue-qr/[venue_id]
 * Returns today's active QR code for a venue.
 * If none exists for today, creates a new one.
 * Only the venue's owner (or an admin) can see it — the code is what proves
 * a user is physically at the venue, so it must never be public.
 */

// Generate a short human-readable code (like "ABCD-1234")
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (O, 0, I, 1)
  let letters = '';
  for (let i = 0; i < 4; i++) letters += chars[randomInt(chars.length)];
  const nums = String(randomInt(1000, 10000));
  return `${letters}-${nums}`;
}

function todayDate() {
  return kstDateString();
}

/** QR image drawn here (SVG data URL), so the day's code is never sent to an outside service. */
async function qrImage(code: string) {
  const svg = await QRCode.toString(code, { type: 'svg', margin: 2, width: 400, errorCorrectionLevel: 'M' });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ venue_id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const { venue_id } = await params;
    if (!isUuid(venue_id)) return jsonError('venue_id required', 400);

    const admin = getAdmin();

    const { data: venue } = await admin.from('venues').select('owner_id').eq('id', venue_id).maybeSingle();
    if (!venue) return jsonError('not_found', 404);
    if (venue.owner_id !== auth.user.id && !(await isAdminUser(auth.user.id))) {
      return jsonError('forbidden', 403);
    }
    const today = todayDate();

    // Check for existing code today
    const { data: existing } = await admin
      .from('venue_qr_codes')
      .select('id, code, valid_date, created_at')
      .eq('venue_id', venue_id)
      .eq('valid_date', today)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        id: existing.id,
        code: existing.code,
        valid_date: existing.valid_date,
        venue_id,
        image: await qrImage(existing.code),
      });
    }

    // Generate a new one for today
    let code = generateCode();
    // Ensure uniqueness (very unlikely collision, but safe)
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: dup } = await admin
        .from('venue_qr_codes')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (!dup) break;
      code = generateCode();
    }

    // One code per venue per day (unique index): if two first loads race, the second insert is
    // ignored and both read back the same row.
    const { error: createErr } = await admin
      .from('venue_qr_codes')
      .upsert({ venue_id, code, valid_date: today }, { onConflict: 'venue_id,valid_date', ignoreDuplicates: true });
    if (createErr) return jsonError(`create_failed: ${createErr.message}`, 500);
    const { data: created } = await admin
      .from('venue_qr_codes')
      .select('id, code, valid_date')
      .eq('venue_id', venue_id)
      .eq('valid_date', today)
      .maybeSingle();
    if (!created) return jsonError('create_failed', 500);

    return NextResponse.json({
      id: created.id,
      code: created.code,
      valid_date: created.valid_date,
      venue_id,
      image: await qrImage(created.code),
    });
  } catch (e: any) {
    return jsonError(publicError(e, 'server_error', 'venue-qr'), 500);
  }
}