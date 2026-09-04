import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/venue-stats/[venue_id]
 *
 * Returns stats for a venue:
 *   - visits_this_week: check-ins in last 7 days
 *   - upcoming_groups: groups scheduled in future at this venue
 *   - total_visitors: unique users who ever checked in
 *   - review_count: total venue reviews
 *   - compliment_counts: {tag_id: count} aggregate
 *   - concern_counts: {tag_id: count} aggregate (private, only owner sees)
 *   - recent_text_reviews: up to 10 most recent short-text reviews
 */

export async function GET(request: Request, { params }: { params: Promise<{ venue_id: string }> }) {
  try {
    const { venue_id } = await params;
    if (!venue_id) return NextResponse.json({ error: 'venue_id required' }, { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Run queries in parallel
    const [
      visitsRes,
      upcomingRes,
      totalVisitorsRes,
      reviewsRes,
    ] = await Promise.all([
      // Visits this week
      admin
        .from('quest_check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venue_id)
        .gte('checked_in_at', sevenDaysAgo),

      // Upcoming scheduled groups at this venue
      admin
        .from('quests')
        .select('id, group_id, group:groups!inner(id, phase, quest_scheduled_at)', { count: 'exact' })
        .eq('venue_id', venue_id)
        .eq('group.phase', 'scheduled')
        .gt('group.quest_scheduled_at', now),

      // Total unique visitors
      admin
        .from('quest_check_ins')
        .select('user_id')
        .eq('venue_id', venue_id),

      // All venue reviews
      admin
        .from('venue_reviews')
        .select('id, compliment_tags, concern_tags, short_text, submitted_at')
        .eq('venue_id', venue_id)
        .order('submitted_at', { ascending: false }),
    ]);

    // Compute total unique visitors from user_id list
    const uniqueVisitorIds = new Set((totalVisitorsRes.data ?? []).map((r: any) => r.user_id));
    const totalVisitors = uniqueVisitorIds.size;

    // Aggregate compliment/concern counts
    const complimentCounts: Record<string, number> = {};
    const concernCounts: Record<string, number> = {};
    const recentTextReviews: any[] = [];

    for (const r of reviewsRes.data ?? []) {
      for (const t of r.compliment_tags ?? []) complimentCounts[t] = (complimentCounts[t] ?? 0) + 1;
      for (const t of r.concern_tags ?? []) concernCounts[t] = (concernCounts[t] ?? 0) + 1;
      if (r.short_text && recentTextReviews.length < 10) {
        recentTextReviews.push({
          text: r.short_text,
          submitted_at: r.submitted_at,
        });
      }
    }

    return NextResponse.json({
      visits_this_week: visitsRes.count ?? 0,
      upcoming_groups: upcomingRes.count ?? 0,
      total_visitors: totalVisitors,
      review_count: reviewsRes.data?.length ?? 0,
      compliment_counts: complimentCounts,
      concern_counts: concernCounts,
      recent_text_reviews: recentTextReviews,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}