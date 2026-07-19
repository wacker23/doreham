// app/api/emails/match-created/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { matchCreatedEmail } from '@/lib/emails/templates';

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      recipientName,
      otherMemberNames,
      venueName,
      questTitle,
      questTitleEn,
      questDescription,
      questDescriptionEn,
      daysToComplete,
    } = await request.json();

    console.log('Match email request received:', { userId, recipientName, venueName });

    if (!userId || !recipientName || !otherMemberNames || !venueName) {
      console.error('Missing fields:', { userId, recipientName, otherMemberNames, venueName });
      return NextResponse.json(
        { error: 'missing_fields' },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!resendKey || !supabaseUrl || !serviceRoleKey) {
      console.error('Missing env vars', {
        hasResend: !!resendKey,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey,
      });
      return NextResponse.json(
        { error: 'not_configured' },
        { status: 500 }
      );
    }

    // Create a supabase client with service role — bypasses RLS to read auth.users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Look up the user's email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user?.email) {
      console.error('User email lookup failed:', userError);
      return NextResponse.json(
        { error: 'user_email_not_found' },
        { status: 404 }
      );
    }

    const userEmail = userData.user.email;
    console.log('Sending to:', userEmail);

    const resend = new Resend(resendKey);
    const { subject, html } = matchCreatedEmail({
      recipientName,
      otherMemberNames,
      venueName,
      questTitle,
      questTitleEn,
      questDescription,
      questDescriptionEn,
      daysToComplete: daysToComplete ?? 14,
    });

    const result = await resend.emails.send({
      from: 'Doreham <noreply@doreham.co.kr>',
      replyTo: 'sophia@doreham.co.kr',
      to: [userEmail],
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

    return NextResponse.json({ ok: true, id: result.data?.id, sentTo: userEmail });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}