// app/api/emails/venue-rejected/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { venueRejectedEmail } from '@/lib/emails/templates';

export async function POST(request: NextRequest) {
  try {
    const { to, venueName, reason } = await request.json();

    if (!to || !venueName || !reason) {
      return NextResponse.json(
        { error: 'missing_fields' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'email_not_configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const { subject, html } = venueRejectedEmail(venueName, reason);

    const result = await resend.emails.send({
      from: 'Doreham <noreply@doreham.co.kr>',
      replyTo: 'sophia@doreham.co.kr',
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return NextResponse.json(
        { error: 'send_failed', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}