import { NextResponse } from 'next/server';
import { jsonError, isUuid, readJson, requireAdmin } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { EMAIL_FROM_PLAIN, getResend } from '@/lib/server/emails/common';
import { venueApprovedEmail, venueRejectedEmail } from '@/lib/emails/templates';
import { purgeVenueFiles } from '@/lib/server/venues';

/**
 * Admin venue review (/admin/venues).
 *   GET                                   → venues waiting for review, with their menu items
 *   POST { action: 'approve', venue_id }  → approve + email the owner
 *   POST { action: 'reject', venue_id, reason } → email the owner, then remove the venue
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
  return NextResponse.json({ venues: venues ?? [], menu_items: menu ?? [] });
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
  const body = await readJson<{ action: string; venue_id: string; reason: string }>(request);
  if (!isUuid(body.venue_id)) return jsonError('venue_id required', 400);
  const admin = getAdmin();

  if (body.action === 'approve') {
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
