import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Versioned user consents (table user_consents). Written only here, with the service role.
 *
 * volunteer_photos — needed before a volunteer (봉사) quest: the group selfie that proves attendance,
 * the optional 1365 certificate, and the optional location attached to the selfie. Photos are shown
 * only to the group and deleted automatically after PROOF_RETENTION_DAYS.
 */
export type ConsentKind = 'volunteer_photos';

/** Bump when the consent text changes in a way people should agree to again. */
export const CONSENT_VERSIONS: Record<ConsentKind, string> = {
  volunteer_photos: '2026-09-29',
};

/** Group selfies and certificates are deleted this many days after upload. */
export const PROOF_RETENTION_DAYS = 90;

export const PROOF_BUCKET = 'volunteer-proofs';

export async function hasConsent(userId: string, kind: ConsentKind): Promise<boolean> {
  const { data } = await getAdmin()
    .from('user_consents')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', kind)
    .is('withdrawn_at', null)
    .limit(1);
  return !!data && data.length > 0;
}

export async function listConsents(userId: string) {
  const { data } = await getAdmin()
    .from('user_consents')
    .select('kind, version, agreed_at')
    .eq('user_id', userId)
    .is('withdrawn_at', null);
  return data ?? [];
}

export async function grantConsent(userId: string, kind: ConsentKind) {
  if (await hasConsent(userId, kind)) return { ok: true as const, already: true };
  const { error } = await getAdmin()
    .from('user_consents')
    .insert({ user_id: userId, kind, version: CONSENT_VERSIONS[kind] });
  // A unique-index race means another request already recorded it.
  if (error && !/duplicate key/i.test(error.message)) return { ok: false as const, error: error.message };
  return { ok: true as const, already: false };
}

/** Delete proof files and rows. Storage first, so a failure never leaves a row without its file tracked. */
export async function deleteProofs(proofs: { id: string; storage_path: string }[]) {
  if (proofs.length === 0) return 0;
  const admin = getAdmin();
  let deleted = 0;
  for (let i = 0; i < proofs.length; i += 100) {
    const batch = proofs.slice(i, i + 100);
    const { error } = await admin.storage.from(PROOF_BUCKET).remove(batch.map((p) => p.storage_path));
    if (error) {
      console.error('Proof file deletion failed:', error.message);
      continue;
    }
    const { error: rowErr } = await admin.from('volunteer_proofs').delete().in('id', batch.map((p) => p.id));
    if (!rowErr) deleted += batch.length;
  }
  return deleted;
}

/**
 * Withdraw a consent. For volunteer_photos this deletes every photo/certificate the user uploaded
 * or appears in, and is refused while they are in an active volunteer quest (the photo is how the
 * group finishes it).
 */
export async function withdrawConsent(userId: string, kind: ConsentKind) {
  const admin = getAdmin();
  if (kind === 'volunteer_photos') {
    const { data: memberships } = await admin
      .from('group_members')
      .select('group_id, groups!inner(phase, quest_type)')
      .eq('user_id', userId)
      .is('left_at', null);
    const active = (memberships ?? []).some((m) => {
      const g = m.groups as unknown as { phase: string; quest_type: string };
      return g.quest_type === 'volunteer' && ['availability', 'voting', 'scheduled'].includes(g.phase);
    });
    if (active) return { ok: false as const, error: 'active_volunteer_quest' };

    const [{ data: uploaded }, { data: tagged }] = await Promise.all([
      admin.from('volunteer_proofs').select('id, storage_path').eq('user_id', userId),
      admin.from('volunteer_proofs').select('id, storage_path').contains('tagged_user_ids', [userId]),
    ]);
    const byId = new Map([...(uploaded ?? []), ...(tagged ?? [])].map((p) => [p.id as string, p as { id: string; storage_path: string }]));
    await deleteProofs([...byId.values()]);
  }
  await admin
    .from('user_consents')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('kind', kind)
    .is('withdrawn_at', null);
  return { ok: true as const };
}

/** Daily cron: delete group selfies and certificates older than the retention period. */
export async function deleteExpiredProofs() {
  const cutoff = new Date(Date.now() - PROOF_RETENTION_DAYS * 24 * 3600_000).toISOString();
  const { data } = await getAdmin()
    .from('volunteer_proofs')
    .select('id, storage_path')
    .lt('created_at', cutoff)
    .limit(1000);
  const deleted = await deleteProofs((data ?? []) as { id: string; storage_path: string }[]);
  return { ok: true as const, expired: data?.length ?? 0, deleted };
}
