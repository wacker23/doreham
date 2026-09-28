import { NextResponse } from 'next/server';
import { isUuid, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';


/**
 * POST /api/mark-question-set-complete
 * body: { group_id, set: 1 | 2 | 3 | 4 }  (signed-in user)
 *
 * Marks a set complete for the group. Enforces progressive unlock:
 * you can only complete a set if all previous sets are complete.
 */

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const user_id = auth.user.id;
  try {
    const { group_id, set } = await readJson<Record<string, any>>(request);
    if (!isUuid(group_id) || !set) {
      return NextResponse.json({ error: 'group_id, user_id, set required' }, { status: 400 });
    }
    if (![1, 2, 3, 4].includes(set)) {
      return NextResponse.json({ error: 'set must be 1, 2, 3, or 4' }, { status: 400 });
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

    // Get current progress
    const { data: progress } = await admin
      .from('group_question_progress')
      .select('*')
      .eq('group_id', group_id)
      .maybeSingle();

    if (!progress) return NextResponse.json({ error: 'No progress row' }, { status: 404 });

    // Enforce progressive unlock
    if (set === 2 && !progress.set_1_complete_at) {
      return NextResponse.json({ error: 'Complete Set 1 first' }, { status: 400 });
    }
    if (set === 3 && !progress.set_2_complete_at) {
      return NextResponse.json({ error: 'Complete Set 2 first' }, { status: 400 });
    }
    if (set === 4) {
      if (!progress.set_3_complete_at) {
        return NextResponse.json({ error: 'Complete Set 3 first' }, { status: 400 });
      }
      if (!progress.set_4_warning_acknowledged_at) {
        return NextResponse.json({ error: 'Acknowledge Set 4 warning first' }, { status: 400 });
      }
    }

    const updateField = `set_${set}_complete_at`;
    const { error } = await admin
      .from('group_question_progress')
      .update({ [updateField]: new Date().toISOString() })
      .eq('group_id', group_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}