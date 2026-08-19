import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { request_id, user_id } = await request.json();
    if (!request_id || !user_id) {
      return NextResponse.json({ error: 'request_id and user_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: req } = await admin
      .from('match_requests')
      .select('user_id, status, matched_group_id')
      .eq('id', request_id)
      .maybeSingle();

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.user_id !== user_id) return NextResponse.json({ error: 'Not your request' }, { status: 403 });

    // Mark request cancelled
    await admin.from('match_requests').update({
      status: 'cancelled_by_user',
      resolved_at: new Date().toISOString(),
    }).eq('id', request_id);

    // If a group was matched → clean it up
    if (req.matched_group_id) {
      const groupId = req.matched_group_id;

      // Check if group is still pending invites (not yet activated)
      const { data: group } = await admin
        .from('groups')
        .select('is_pending_invites, phase')
        .eq('id', groupId)
        .maybeSingle();

      // Mark all members as left
      await admin.from('group_members').update({
        left_at: new Date().toISOString(),
      }).eq('group_id', groupId).is('left_at', null);

      // Mark group cleanly closed
      await admin.from('groups').update({
        is_pending_invites: false,
        phase: 'cancelled',
      }).eq('id', groupId);

      // Cancel the quest
      await admin.from('quests').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }).eq('group_id', groupId);

      // If the requester cancelled AFTER availability phase started → count as strike
      if (group?.phase === 'availability' || group?.phase === 'voting') {
        // Count current strikes
        const { data: currentPenalties } = await admin
          .from('user_penalties')
          .select('strike_number')
          .eq('user_id', user_id)
          .order('strike_number', { ascending: false })
          .limit(1);

        const nextStrike = (currentPenalties?.[0]?.strike_number ?? 0) + 1;

        // Freeze duration based on strike count
        let freezeUntil: string | null = null;
        if (nextStrike >= 4) {
          freezeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week
        } else if (nextStrike === 3) {
          freezeUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h
        }

        await admin.from('user_penalties').insert({
          user_id,
          reason: 'cancelled_match',
          strike_number: nextStrike,
          freeze_until: freezeUntil,
          notes: `Cancelled match request after ${group.phase} phase started (group ${groupId})`,
        });

        return NextResponse.json({
          ok: true,
          cancelled_group: true,
          strike_issued: true,
          strike_number: nextStrike,
          frozen_until: freezeUntil,
        });
      }

      return NextResponse.json({ ok: true, cancelled_group: true, strike_issued: false });
    }

    return NextResponse.json({ ok: true, cancelled_group: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}