import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/server/auth';
import { getPublicStats } from '@/lib/server/publicStats';

/**
 * GET /api/stats  (public, no login)
 * Live totals for the homepage counter: matches made, meetups completed, success rate,
 * meetups coming up. Counts only. Cached for 30 s at the edge, so a busy homepage costs
 * at most a few database count queries a minute.
 */
export async function GET() {
  try {
    const stats = await getPublicStats();
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (e) {
    console.error('[stats] failed:', e instanceof Error ? e.message : e);
    return jsonError('server_error', 500);
  }
}
