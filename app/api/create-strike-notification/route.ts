import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

/**
 * POST /api/create-strike-notification
 * body: {
 *   user_id: string,
 *   reason: 'cancelled_match' | 'no_show' | 'reported_behavior',
 *   strike_number: number,
 *   freeze_until: string | null,
 * }
 *
 * Called internally from cancel-match-request and close-expired-quests
 * whenever a strike is issued. Creates in-app notification (fire-and-forget
 * emails are sent separately from the caller).
 */

const REASON_TEXT: Record<string, { en: string; ko: string }> = {
  cancelled_match: {
    en: 'You cancelled a match after the availability phase started.',
    ko: '가능한 시간 단계 이후에 매칭을 취소했어요.',
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

export async function POST(request: Request) {
  try {
    const { user_id, reason, strike_number, freeze_until } = await request.json();
    if (!user_id || !reason || !strike_number) {
      return NextResponse.json({ error: 'user_id, reason, strike_number required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const reasonText = REASON_TEXT[reason] || { en: reason, ko: reason };

    let bodyEn = reasonText.en;
    let bodyKo = reasonText.ko;

    if (freeze_until) {
      const until = new Date(freeze_until);
      const dateEn = until.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const dateKo = until.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      bodyEn += ` Account frozen until ${dateEn}.`;
      bodyKo += ` ${dateKo}까지 계정이 정지됩니다.`;
    }

    const { error } = await admin.from('notifications').insert({
      user_id,
      type: 'strike_issued',
      title_en: `⚠️ You received strike #${strike_number}`,
      title_ko: `⚠️ ${strike_number}번째 경고를 받았어요`,
      body_en: bodyEn,
      body_ko: bodyKo,
      action_url: '/matches',
      is_important: true,
    });

    if (error) {
      console.error('Strike notification insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}