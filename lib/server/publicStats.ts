import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/** The success rate is only shown once this many matches have finished (one way or the other). */
export const MIN_FINISHED_FOR_RATE = 5;

export type PublicStats = {
  /** Groups that formed: every invite accepted. */
  matches: number;
  /** Meetups that happened: venue quests with enough QR check-ins, volunteer quests with the group selfie. */
  completed: number;
  /** Matched groups that are over: met (completed) or didn't (cancelled after forming). */
  finished: number;
  /** completed / finished in %, or null while there are too few finished matches to say. */
  success_rate: number | null;
  /** Meetups scheduled right now (date locked, not over yet). */
  upcoming: number;
  updated_at: string;
};

/**
 * Totals for the public homepage counter. Counts only, never who: nothing here identifies a person.
 */
export async function getPublicStats(): Promise<PublicStats> {
  const admin = getAdmin();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error('stats_query_failed');
    return n ?? 0;
  };
  const head = { count: 'exact' as const, head: true };

  const [matches, completed, cancelledAfterMatch, upcoming] = await Promise.all([
    count(admin.from('groups').select('id', head).not('activated_at', 'is', null)),
    count(admin.from('quests').select('id', head).eq('status', 'completed')),
    count(admin.from('groups').select('id', head).not('activated_at', 'is', null).eq('phase', 'cancelled')),
    count(admin.from('groups').select('id', head).eq('phase', 'scheduled')),
  ]);

  const finished = completed + cancelledAfterMatch;
  return {
    matches,
    completed,
    finished,
    success_rate: finished >= MIN_FINISHED_FOR_RATE ? Math.round((completed / finished) * 100) : null,
    upcoming,
    updated_at: new Date().toISOString(),
  };
}
