import { NextResponse } from 'next/server';
import { jsonError, isUuid, readJson, requireAdmin } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { EMAIL_FROM_PLAIN, getResend } from '@/lib/server/emails/common';
import { venueApprovedEmail, venueRejectedEmail } from '@/lib/emails/templates';
import { purgeVenueFiles } from '@/lib/server/venues';
import { ensureVenuePin, geocodeAddress, parseLatLng } from '@/lib/server/geocode';

/**
 * Admin venue review (/admin/venues).
 *   GET                                   → venues waiting for review, with their menu items,
 *                                           and approved venues that have no map pin
 *   POST { action: 'approve', venue_id }  → approve + email the owner (needs a map pin)
 *   POST { action: 'reject', venue_id, reason } → email the owner, then remove the venue
 *   POST { action: 'set_pin', venue_id, pin } → save the map pin: "37.5345, 126.9935" or a map
 *                                           link; an empty pin looks it up from the address
 *
 * The map pin is what QR check-in measures the member's GPS against.
 *
 * The owner's contact details and registration number are not readable from the browser,
 * so this page loads them here. Emails go to the address stored on the venue, never one
 * sent by the browser.
 */

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const admin = getAdmin();
  const { data: venues, error } = await admin
    .from('venues')
    .select('*')
    .eq('is_active', false)
    .is('deactivated_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[admin/venues] load failed:', error);
    return jsonError('server_error', 500);
  }
  const ids = (venues ?? []).map((v) => v.id as string);
  const { data: menu } = ids.length
    ? await admin.from('venue_menu_items').select('*').in('venue_id', ids)
    : { data: [] };
  const { data: missingPin } = await admin
    .from('venues')
    .select('id, business_name_display, city, address, road_address')
    .eq('is_active', true)
    .is('deactivated_at', null)
    .or('latitude.is.null,longitude.is.null')
    .order('created_at', { ascending: true });
  return NextResponse.json({ venues: venues ?? [], menu_items: menu ?? [], missing_pin: missingPin ?? [] });
}

async function sendEmail(to: string, mail: { subject: string; html: string }) {
  try {
    const result = await getResend().emails.send({ from: EMAIL_FROM_PLAIN, replyTo: 'info@doreham.co.kr', to: [to], ...mail });
    if (result.error) console.error('[admin/venues] email failed:', result.error.message);
    return !result.error;
  } catch (e) {
    console.error('[admin/venues] email failed:', e);
    return false;
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = await readJson<{ action: string; venue_id: string; reason: string; pin: string }>(request);
  if (!isUuid(body.venue_id)) return jsonError('venue_id required', 400);
  const admin = getAdmin();

  if (body.action === 'set_pin') {
    const { data: v } = await admin
      .from('venues')
      .select('id, road_address, address')
      .eq('id', body.venue_id)
      .is('deactivated_at', null)
      .maybeSingle();
    if (!v) return jsonError('not_found', 404);
    const typed = typeof body.pin === 'string' ? body.pin.trim() : '';
    const pin = typed
      ? parseLatLng(typed)
      : (await geocodeAddress(v.road_address as string | null)) ?? (await geocodeAddress(v.address as string | null));
    if (!pin) return jsonError(typed ? 'bad_pin' : 'pin_not_found', 400);
    const { error } = await admin.from('venues').update({ latitude: pin.lat, longitude: pin.lng }).eq('id', v.id);
    if (error) {
      console.error('[admin/venues] set pin failed:', error);
      return jsonError('server_error', 500);
    }
    return NextResponse.json({ ok: true, latitude: pin.lat, longitude: pin.lng });
  }

  if (body.action === 'approve') {
    // No approval without a map pin: check-in can't confirm anyone is at the venue otherwise.
    if (!(await ensureVenuePin(body.venue_id))) return jsonError('pin_required', 400);
    const { data: venue, error } = await admin
      .from('venues')
      .update({ is_active: true, claim_verified_at: new Date().toISOString() })
      .eq('id', body.venue_id)
      .eq('is_active', false)
      .is('deactivated_at', null)
      .select('id, business_name_display, contact_email')
      .maybeSingle();
    if (error) {
      console.error('[admin/venues] approve failed:', error);
      return jsonError('server_error', 500);
    }
    if (!venue) return jsonError('not_found', 404);
    const emailed = venue.contact_email
      ? await sendEmail(venue.contact_email, venueApprovedEmail(venue.business_name_display, venue.id))
      : false;
    return NextResponse.json({ ok: true, emailed });
  }

  if (body.action === 'reject') {
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    if (!reason) return jsonError('reason_required', 400);
    const { data: venue } = await admin
      .from('venues')
      .select('id, owner_id, business_name_display, contact_email, photo_urls, is_active')
      .eq('id', body.venue_id)
      .maybeSingle();
    if (!venue || venue.is_active) return jsonError('not_found', 404);
    const { data: menu } = await admin.from('venue_menu_items').select('photo_url').eq('venue_id', venue.id);

    // Email first, while we still have the details.
    const emailed = venue.contact_email
      ? await sendEmail(venue.contact_email, venueRejectedEmail(venue.business_name_display, reason))
      : false;

    const { error } = await admin.from('venues').delete().eq('id', venue.id); // menu items cascade
    if (error) {
      console.error('[admin/venues] reject failed:', error);
      return jsonError('server_error', 500);
    }
    await purgeVenueFiles(venue.owner_id as string, venue.photo_urls, (menu ?? []).map((m) => m.photo_url as string | null));
    return NextResponse.json({ ok: true, emailed });
  }

  return jsonError('bad_action', 400);
}
