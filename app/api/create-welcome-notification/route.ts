import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/create-welcome-notification
 * body: { user_id: string, display_name?: string }
 *
 * Creates a welcome notification for a user after onboarding.
 * Uses service role so it works regardless of RLS insert policy.
 */

export async function POST(request: Request) {
  try {
    const { user_id, display_name } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch language preference
    const { data: profile } = await admin
      .from('profiles')
      .select('primary_language, display_name')
      .eq('id', user_id)
      .maybeSingle();

    const name = display_name || profile?.display_name || '';
    const nameEn = name ? `, ${name}` : '';
    const nameKo = name ? `, ${name}님` : '';

    const { error } = await admin.from('notifications').insert({
      user_id,
      type: 'welcome',
      title_en: `Welcome to Doreham${nameEn}! 🌸`,
      title_ko: `도레함에 오신 것을 환영해요${nameKo}! 🌸`,
      body_en: "You're all set. Head to Matches to find your first group of friends.",
      body_ko: '준비 완료! 매칭 페이지에서 첫 그룹을 찾아보세요.',
      action_url: '/matches',
      is_important: false,
    });

    if (error) {
      console.error('Welcome notification insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Welcome notification error:', e);
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}