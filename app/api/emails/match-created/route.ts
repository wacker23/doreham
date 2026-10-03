// app/api/emails/match-created/route.ts
// Admin-only: email a member that /admin/matches put them in a group.
// The address is looked up on the server from the user id; names/venue/quest text are escaped
// in the template.

import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireAdmin } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { EMAIL_FROM_PLAIN, getResend } from '@/lib/server/emails/common';
import { matchCreatedEmail } from '@/lib/emails/templates';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    userId: string;
    recipientName: string;
    otherMemberNames: unknown;
    venueName: string;
    questTitle: string;
    questTitleEn: string;
    questDescription: string;
    questDescriptionEn: string;
    daysToComplete: number;
  }>(request);

  const otherMemberNames = Array.isArray(body.otherMemberNames)
    ? body.otherMemberNames.filter((n): n is string => typeof n === 'string').slice(0, 5).map((n) => n.slice(0, 60))
    : [];
  if (!isUuid(body.userId) || !str(body.recipientName, 60) || otherMemberNames.length === 0 || !str(body.venueName, 100)) {
    return jsonError('missing_fields', 400);
  }

  try {
    const { data: userData, error: userError } = await getAdmin().auth.admin.getUserById(body.userId);
    const userEmail = userData?.user?.email;
    if (userError || !userEmail) return jsonError('user_email_not_found', 404);

    const { subject, html } = matchCreatedEmail({
      recipientName: str(body.recipientName, 60),
      otherMemberNames,
      venueName: str(body.venueName, 100),
      questTitle: str(body.questTitle, 200),
      questTitleEn: str(body.questTitleEn, 200),
      questDescription: str(body.questDescription, 2000),
      questDescriptionEn: str(body.questDescriptionEn, 2000),
      daysToComplete: Number(body.daysToComplete) || 14,
    });

    const result = await getResend().emails.send({
      from: EMAIL_FROM_PLAIN,
      replyTo: 'sophia@doreham.co.kr',
      to: [userEmail],
      subject,
      html,
    });
    if (result.error) {
      console.error('[match-created] send failed:', result.error.message);
      return jsonError('send_failed', 500);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[match-created] error:', error);
    return jsonError('server_error', 500);
  }
}
