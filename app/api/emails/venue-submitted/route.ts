// app/api/emails/venue-submitted/route.ts
// Confirmation email after a venue owner submits a listing.
//
// POST { venue_id } — signed-in owner only. The recipient is the venue's own
// contact_email from the database, never an address supplied by the browser.
// Sent at most once per venue, right after it is created (see the claim below).

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

  // Claim the one-and-only "submitted" email for this venue atomically: only the owner, only a
  // venue still waiting for review, only within 15 minutes of creating it (created_at is set by
  // the database, not the browser), and only once (submitted_email_sent_at).
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: venue, error: claimErr } = await getAdmin()
    .from('venues')
    .update({ submitted_email_sent_at: new Date().toISOString() })
    .eq('id', venue_id)
    .eq('owner_id', auth.user.id)
    .eq('is_active', false)
    .is('deactivated_at', null)
    .is('submitted_email_sent_at', null)
    .gte('created_at', since)
    .select('contact_email, business_name_display')
    .maybeSingle();
  if (claimErr) {
    console.error('[venue-submitted] claim failed:', claimErr);
    return jsonError('server_error', 500);
  }
  if (!venue) return NextResponse.json({ ok: true, skipped: 'not_applicable' });
  if (!venue.contact_email) return NextResponse.json({ ok: true, skipped: 'no_contact_email' });

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
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Email send error:', error);
    return jsonError('server_error', 500);
  }
}
