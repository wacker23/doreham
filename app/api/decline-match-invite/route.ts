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
      .select('invite_state')
      .eq('group_id', group_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    if (membership.invite_state !== 'invited') {
      return NextResponse.json({ error: `Cannot decline — current state: ${membership.invite_state}` }, { status: 400 });
    }

    await admin.from('group_members').update({
      invite_state: 'declined',
      declined_at: new Date().toISOString(),
      left_at: new Date().toISOString(),
    }).eq('group_id', group_id).eq('user_id', user_id);

    const { data: allMembers } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at, left_at')
      .eq('group_id', group_id)
      .is('left_at', null);

    if (!allMembers) {
      return NextResponse.json({ ok: true, note: 'Declined, could not verify group' });
    }

    const activeMembers = allMembers.filter((m: any) => m.invite_state === 'accepted' || m.accepted_at);
    const pendingMembers = allMembers.filter((m: any) => m.invite_state === 'invited');

    const { data: group } = await admin
      .from('groups')
      .select('id, originated_by_request_id, is_pending_invites')
      .eq('id', group_id)
      .maybeSingle();

    if (!group?.is_pending_invites) {
      return NextResponse.json({ ok: true, note: 'Group already active, member left' });
    }

    // CANCEL — everyone responded but not enough accepted
    if (pendingMembers.length === 0 && activeMembers.length < MIN_GROUP_SIZE) {
      await admin.from('groups').update({
        is_pending_invites: false,
      }).eq('id', group_id);

      await admin.from('group_members').update({
        left_at: new Date().toISOString(),
      }).eq('group_id', group_id).is('left_at', null);

      await admin.from('quests').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }).eq('group_id', group_id);

      if (group.originated_by_request_id) {
        const { data: req } = await admin
          .from('match_requests')
          .select('excluded_user_ids, user_id')
          .eq('id', group.originated_by_request_id)
          .maybeSingle();

        const newExcluded = new Set(req?.excluded_user_ids ?? []);
        for (const m of allMembers) {
          if (m.user_id !== user_id) newExcluded.add(m.user_id);
        }
        newExcluded.add(user_id);

        await admin.from('match_requests').update({
          status: 'searching',
          matched_group_id: null,
          excluded_user_ids: Array.from(newExcluded),
        }).eq('id', group.originated_by_request_id);

        // Email requester about the cancellation
        if (req?.user_id) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr'}/api/emails/group-cancelled`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: req.user_id,
                reason: 'Not enough people accepted the invite',
                will_retry: true,
              }),
            });
          } catch (e) { console.error('Cancellation email failed:', e); }
        }
      }

      return NextResponse.json({ ok: true, note: 'Group cancelled, request reopened' });
    }

    // ACTIVATE — everyone responded AND enough accepted
    if (pendingMembers.length === 0 && activeMembers.length >= MIN_GROUP_SIZE) {
      await admin.from('groups').update({
        is_pending_invites: false,
      }).eq('id', group_id);

      // Send activation emails
      const memberIds = activeMembers.map((m: any) => m.user_id);
      const [{ data: profiles }, { data: quest }] = await Promise.all([
        admin.from('profiles').select('id, display_name').in('id', memberIds),
        admin.from('quests').select('venue:venues!inner(business_name_display)').eq('group_id', group_id).maybeSingle(),
      ]);
      const venueName = (quest as any)?.venue?.business_name_display ?? '';
      const allNames = (profiles ?? []).map((p: any) => p.display_name);

      Promise.all((profiles ?? []).map(async (p: any) => {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr'}/api/emails/group-activated`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: p.id,
              group_id,
              venue_name: venueName,
              other_member_names: allNames.filter((n: string) => n !== p.display_name),
            }),
          });
        } catch (e) { console.error('Activation email failed:', e); }
      })).catch((e) => console.error(e));

      return NextResponse.json({
        ok: true,
        activated: true,
        note: 'Group activated with remaining members',
        active_count: activeMembers.length,
      });
    }

    // Still waiting for other invitees
    return NextResponse.json({ ok: true, note: 'Declined, waiting for other invitees to respond' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}