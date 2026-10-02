import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { evaluatePendingGroup, leaveGroup } from '@/lib/server/groupLifecycle';
import { cancelEvent } from '@/lib/server/events';
import { deleteProofs } from '@/lib/server/consents';
import { deleteVenue } from '@/lib/server/venues';

/**
 * Delete my account (Profile → Delete account). What the privacy policy promises:
 * profile, matches, points, events, venues and photos go; group chat messages stay, anonymized.
 *
 * Order matters: first wind down what other people depend on (running groups, upcoming events,
 * venues), then clear the few references that would block the delete, then delete the login.
 * Deleting the auth user cascades through profiles to almost every table.
 */

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });

export async function deleteAccount(userId: string): Promise<{ ok: true } | Fail> {
  const admin = getAdmin();
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (profile?.role === 'admin') return fail('admin_account', 403);

  // 1. Groups: decline open invites; leave running groups the usual way, so the others are told
  //    and the group goes on or is cancelled. (A strike from that dies with the account.)
  const { data: memberships } = await admin
    .from('group_members')
    .select('group_id, invite_state')
    .eq('user_id', userId)
    .is('left_at', null);
  const now = new Date().toISOString();
  for (const m of memberships ?? []) {
    const groupId = m.group_id as string;
    if (m.invite_state === 'invited') {
      await admin
        .from('group_members')
        .update({ invite_state: 'declined', declined_at: now, left_at: now })
        .eq('group_id', groupId)
        .eq('user_id', userId);
      await evaluatePendingGroup(groupId);
    } else {
      await leaveGroup(userId, groupId); // finished groups answer "not active": nothing to do
    }
  }

  // 2. Upcoming events they host are cancelled (people going get the usual notification).
  const { data: events } = await admin
    .from('events')
    .select('id')
    .eq('creator_id', userId)
    .eq('status', 'published')
    .gt('starts_at', now);
  for (const e of events ?? []) await cancelEvent(userId, e.id as string);

  // 3. Venues: removed like "Delete" in My venues. One that past quests point at is kept as an
  //    empty, hidden record owned by Doreham; any other is deleted outright.
  const { data: venues } = await admin.from('venues').select('id, deactivated_at').eq('owner_id', userId);
  if (venues && venues.length) {
    for (const v of venues) if (!v.deactivated_at) await deleteVenue(userId, v.id as string);
    const ids = venues.map((v) => v.id as string);
    const { data: used } = await admin.from('quests').select('venue_id').in('venue_id', ids);
    const keep = new Set((used ?? []).map((q) => q.venue_id as string));
    const drop = ids.filter((id) => !keep.has(id));
    if (drop.length) await admin.from('venues').delete().in('id', drop);
    if (keep.size) {
      const { data: owner } = await admin.from('profiles').select('id').eq('role', 'admin').is('deleted_at', null).limit(1).maybeSingle();
      if (!owner) return fail('cannot_delete_now', 500);
      await admin.from('venues').update({ owner_id: owner.id }).in('id', [...keep]);
    }
  }

  // 4. Photos: volunteer group photos they uploaded or appear in, and their profile photos.
  const [{ data: uploaded }, { data: tagged }] = await Promise.all([
    admin.from('volunteer_proofs').select('id, storage_path').eq('user_id', userId),
    admin.from('volunteer_proofs').select('id, storage_path').contains('tagged_user_ids', [userId]),
  ]);
  const proofs = new Map([...(uploaded ?? []), ...(tagged ?? [])].map((p) => [p.id as string, p as { id: string; storage_path: string }]));
  await deleteProofs([...proofs.values()]);
  try {
    const { data: files } = await admin.storage.from('profile-photos').list(userId, { limit: 100 });
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length) await admin.storage.from('profile-photos').remove(paths);
  } catch (e) {
    console.error('profile photo cleanup failed:', e instanceof Error ? e.message : e);
  }

  // 5. References that would otherwise block the delete.
  await Promise.all([
    admin.from('groups').update({ created_by: null }).eq('created_by', userId),
    admin.from('quests').update({ verified_by_user_id: null }).eq('verified_by_user_id', userId),
    admin.from('reports').delete().eq('reporter_id', userId),
    admin.from('reports').update({ target_user_id: null }).eq('target_user_id', userId),
    admin.from('reports').update({ resolved_by: null }).eq('resolved_by', userId),
  ]);

  // 6. The login itself (cascades: profile, requests, memberships, points, push devices…;
  //    chat messages keep their text with no sender).
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('deleteUser failed:', error.message);
    return fail('delete_failed', 500);
  }
  return { ok: true };
}
