// app/api/emails/venue-submitted/route.ts
// Confirmation email after a venue owner submits a listing.
//
// POST { venue_id } — signed-in owner only. The recipient is the venue's own
// contact_email from the database, never an address supplied by the browser
// (this used to be an open relay: { to, venueName }).

import { NextResponse } from 'next/server';
import { venueSubmittedEmail } from '@/lib/emails/templates';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { EMAIL_FROM_PLAIN, getResend } from '@/lib/server/emails/common';

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { venue_id } = await readJson<{ venue_id: string }>(request);
  if (!isUuid(venue_id)) return jsonError('venue_id required', 400);

  const { data: venue } = await getAdmin()
    .from('venues')
    .select('owner_id, contact_email, business_name_display, created_at')
    .eq('id', venue_id)
    .maybeSingle();

  if (!venue || venue.owner_id !== auth.user.id) return jsonError('not_found', 404);
  if (!venue.contact_email) return NextResponse.json({ ok: true, skipped: 'no_contact_email' });
  // Only right after submission — stops this from being replayed to spam the address.
  if (Date.now() - new Date(venue.created_at).getTime() > 15 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: 'too_late' });
  }

  try {
    const { subject, html } = venueSubmittedEmail(venue.business_name_display);
    const result = await getResend().emails.send({
      from: EMAIL_FROM_PLAIN,
      replyTo: 'info@doreham.co.kr',
      to: [venue.contact_email],
      subject,
      html,
    });
    if (result.error) {
      console.error('Resend error:', result.error);
      return jsonError('send_failed', 500);
    }
    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (error) {
    console.error('Email send error:', error);
    return jsonError('server_error', 500);
  }
}
