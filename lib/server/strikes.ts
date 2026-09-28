import 'server-only';
import { after } from 'next/server';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotification } from '@/lib/notifications';
import { sendStrikeIssuedEmail } from '@/lib/server/emails/strike-issued';

export type StrikeReason = 'cancelled_match' | 'no_show' | 'reported_behavior';

const REASON_TEXT: Record<StrikeReason, { en: string; ko: string }> = {
  cancelled_match: {
    en: 'You left a group after it was confirmed.',
    ko: '확정된 그룹에서 나갔어요.',
  },
  no_show: {
    en: "You didn't check in at the meetup.",
    ko: '만남에 체크인하지 않으셨어요.',
  },
  reported_behavior: {
    en: 'A report about your behavior was verified.',
    ko: '행동에 대한 신고가 확인되었어요.',
  },
};

/** Freeze policy: 3rd strike = 48h, 4th+ = 1 week. */
export function freezeUntilFor(strikeNumber: number): string | null {
  if (strikeNumber >= 4) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (strikeNumber === 3) return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  return null;
}

/**
 * Issues the next strike for a user, applies any freeze, and (after the
 * response is sent) creates the in-app notification + email.
 */
export async function issueStrike(userId: string, reason: StrikeReason, notes: string) {
  const admin = getAdmin();

  const { data: latest } = await admin
    .from('user_penalties')
    .select('strike_number')
    .eq('user_id', userId)
    .order('strike_number', { ascending: false })
    .limit(1);

  const strikeNumber = (latest?.[0]?.strike_number ?? 0) + 1;
  const freezeUntil = freezeUntilFor(strikeNumber);

  const { error } = await admin.from('user_penalties').insert({
    user_id: userId,
    reason,
    strike_number: strikeNumber,
    freeze_until: freezeUntil,
    notes,
  });
  if (error) {
    console.error('issueStrike insert failed:', error);
    return { ok: false as const, error: error.message };
  }

  after(async () => {
    const text = REASON_TEXT[reason];
    let bodyEn = text.en;
    let bodyKo = text.ko;
    if (freezeUntil) {
      const until = new Date(freezeUntil);
      const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
      bodyEn += ` Account frozen until ${until.toLocaleString('en-US', opts)}.`;
      bodyKo += ` ${until.toLocaleString('ko-KR', opts)}까지 계정이 정지됩니다.`;
    }
    await createNotification({
      user_id: userId,
      type: 'strike_issued',
      title_en: `⚠️ You received strike #${strikeNumber}`,
      title_ko: `⚠️ ${strikeNumber}번째 경고를 받았어요`,
      body_en: bodyEn,
      body_ko: bodyKo,
      action_url: '/matches',
      is_important: true,
    });
    const res = await sendStrikeIssuedEmail({
      user_id: userId,
      reason,
      strike_number: strikeNumber,
      freeze_until: freezeUntil,
    });
    if (res.error) console.error('Strike email failed:', res.error);
  });

  return { ok: true as const, strike_number: strikeNumber, freeze_until: freezeUntil };
}
