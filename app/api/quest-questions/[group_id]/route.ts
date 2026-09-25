import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/quest-questions/[group_id]?user_id=xxx
 *
 * Returns the group's conversation questions with progress state.
 * On first call for a group, randomly selects 5 questions per set and stores them.
 * User must be a member of the group.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ group_id: string }> }
) {
  try {
    const { group_id } = await params;
    const url = new URL(request.url);
    const user_id = url.searchParams.get('user_id');

    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify user is a member of this group
    const { data: membership } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('user_id', user_id)
      .is('left_at', null)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Get or create progress row
    let { data: progress } = await admin
      .from('group_question_progress')
      .select('*')
      .eq('group_id', group_id)
      .maybeSingle();

    if (!progress) {
      // First call — pick random 5 per set
      const [warmup, gettingReal, deep, depths] = await Promise.all([
        admin.from('conversation_questions').select('id').eq('set_name', 'warmup'),
        admin.from('conversation_questions').select('id').eq('set_name', 'getting_real'),
        admin.from('conversation_questions').select('id').eq('set_name', 'deep'),
        admin.from('conversation_questions').select('id').eq('set_name', 'depths'),
      ]);

      const pickRandom = (arr: any[] | null, n: number): string[] => {
        if (!arr) return [];
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n).map((x) => x.id);
      };

      const newProgress = {
        group_id,
        set_1_question_ids: pickRandom(warmup.data, 5),
        set_2_question_ids: pickRandom(gettingReal.data, 5),
        set_3_question_ids: pickRandom(deep.data, 5),
        set_4_question_ids: pickRandom(depths.data, 5),
      };

      const { data: inserted } = await admin
        .from('group_question_progress')
        .insert(newProgress)
        .select('*')
        .single();

      progress = inserted;
    }

    // Fetch full question texts for all 4 sets
    const allIds = [
      ...(progress!.set_1_question_ids ?? []),
      ...(progress!.set_2_question_ids ?? []),
      ...(progress!.set_3_question_ids ?? []),
      ...(progress!.set_4_question_ids ?? []),
    ];

    const { data: questions } = await admin
      .from('conversation_questions')
      .select('*')
      .in('id', allIds);

    const qMap: Record<string, any> = {};
    (questions ?? []).forEach((q: any) => { qMap[q.id] = q; });

    return NextResponse.json({
      ok: true,
      progress: {
        set_1_complete_at: progress!.set_1_complete_at,
        set_2_complete_at: progress!.set_2_complete_at,
        set_3_complete_at: progress!.set_3_complete_at,
        set_4_complete_at: progress!.set_4_complete_at,
        set_4_warning_acknowledged_at: progress!.set_4_warning_acknowledged_at,
      },
      sets: {
        warmup: (progress!.set_1_question_ids ?? []).map((id: string) => qMap[id]).filter(Boolean),
        getting_real: (progress!.set_2_question_ids ?? []).map((id: string) => qMap[id]).filter(Boolean),
        deep: (progress!.set_3_question_ids ?? []).map((id: string) => qMap[id]).filter(Boolean),
        depths: (progress!.set_4_question_ids ?? []).map((id: string) => qMap[id]).filter(Boolean),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown' }, { status: 500 });
  }
}