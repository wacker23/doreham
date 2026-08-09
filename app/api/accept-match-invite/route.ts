import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MIN_GROUP_SIZE = 2;

export async function POST(request: Request) {
  try {
    const { group_id, user_id } = await request.json();
    if (!group_id || !user_id) {
      return NextResponse.json({ error: 'group_id and user_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: membership } = await admin
      .from('group_members')
      .select('invite_state, invite_expires_at')
      .eq('group_id', group_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    if (membership.invite_state !== 'invited') {
      return NextResponse.json({ error: `Cannot accept — current state: ${membership.invite_state}` }, { status: 400 });
    }

    if (membership.invite_expires_at && new Date(membership.invite_expires_at) < new Date()) {
      await admin.from('group_members').update({
        invite_state: 'expired',
        declined_at: new Date().toISOString(),
      }).eq('group_id', group_id).eq('user_id', user_id);
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    await admin.from('group_members').update({
      invite_state: 'accepted',
      accepted_at: new Date().toISOString(),
    }).eq('group_id', group_id).eq('user_id', user_id);

    const { data: allMembers } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at, declined_at, left_at')
      .eq('group_id', group_id)
      .is('left_at', null);

    if (!allMembers) {
      return NextResponse.json({ ok: true, activated: false, note: 'Accepted, could not verify group state' });
    }

    const activeMembers = allMembers.filter((m: any) => m.invite_state === 'accepted' || m.accepted_at);
    const pendingMembers = allMembers.filter((m: any) => m.invite_state === 'invited');
    const declinedOrExpired = allMembers.filter((m: any) => m.invite_state === 'declined' || m.invite_state === 'expired');

    const everyoneResponded = pendingMembers.length === 0;
    const enoughAccepted = activeMembers.length >= MIN_GROUP_SIZE;

    if (everyoneResponded && enoughAccepted) {
      await admin.from('groups').update({
        is_pending_invites: false,
      }).eq('id', group_id);

      if (declinedOrExpired.length > 0) {
        await admin.from('group_members').update({
          left_at: new Date().toISOString(),
        }).eq('group_id', group_id).in('user_id', declinedOrExpired.map((m: any) => m.user_id));
      }

      return NextResponse.json({
        ok: true,
        activated: true,
        active_count: activeMembers.length,
        pending_count: 0,
      });
    }

    return NextResponse.json({
      ok: true,
      activated: false,
      active_count: activeMembers.length,
      pending_count: pendingMembers.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}