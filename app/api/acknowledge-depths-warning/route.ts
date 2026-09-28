import { NextResponse } from 'next/server';
import { isUuid, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';


/**
 * POST /api/acknowledge-depths-warning
 * body: { group_id }  (signed-in user)
 *
 * Records that the group has acknowledged the Set 4 (depths) warning.
 * Set 4 questions are only visible after this is set.
 * Requires Set 3 complete.
 */

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const user_id = auth.user.id;
  try {
    const { group_id } = await readJson<Record<string, any>>(request);
    if (!isUuid(group_id)) {
      return NextResponse.json({ error: 'group_id, user_id required' }, { status: 400 });
    }

    const admin = getAdmin();

    // Verify member
    const { data: membership } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('user_id', user_id)
      .is('left_at', null)
      .not('accepted_at', 'is', null)
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