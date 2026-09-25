import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/acknowledge-depths-warning
 * body: { group_id, user_id }
 *
 * Records that the group has acknowledged the Set 4 (depths) warning.
 * Set 4 questions are only visible after this is set.
 * Requires Set 3 complete.
 */

export async function POST(request: Request) {
  try {
    const { group_id, user_id } = await request.json();
    if (!group_id || !user_id) {
      return NextResponse.json({ error: 'group_id, user_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify member
    const { data: membership } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('user_id', user_id)
      .is('left_at', null)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Verify Set 3 complete
    const { data: progress } = await admin
      .from('group_question_progress')
      .select('set_3_complete_at, set_4_warning_acknowledged_at')
      .eq('group_id', group_id)
      .maybeSingle();

    if (!progress?.set_3_complete_at) {
      return NextResponse.json({ error: 'Complete Set 3 first' }, { status: 400 });
    }

    if (progress.set_4_warning_acknowledged_at) {
      return NextResponse.json({ ok: true, already: true });
    }

    const { error } = await admin
      .from('group_question_progress')
      .update({ set_4_warning_acknowledged_at: new Date().toISOString() })
      .eq('group_id', group_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}