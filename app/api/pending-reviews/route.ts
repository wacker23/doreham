import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REVIEW_WINDOW_DAYS = 14;

/**
 * GET /api/pending-reviews?user_id=xxx
 *
 * Returns list of quests the user completed but hasn't reviewed yet.
 * For each: quest info, other members to review, venue info.
 */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find groups this user was a member of with completed quests within the review window
    const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: memberships } = await admin
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    const groupIds = memberships.map((m: any) => m.group_id);

    const { data: quests } = await admin
      .from('quests')
      .select('id, group_id, venue_id, completed_at, venue:venues!inner(id, business_name_display)')
      .in('group_id', groupIds)
      .eq('status', 'completed')
      .gte('completed_at', cutoff);

    if (!quests || quests.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    // For each quest: who has this user NOT reviewed yet?
    const pending: any[] = [];

    for (const quest of quests) {
      // Group members (excluding self)
      const { data: members } = await admin
        .from('group_members')
        .select('user_id, profiles:profiles!inner(id, display_name, photo_url)')
        .eq('group_id', quest.group_id)
        .neq('user_id', userId);

      // Reviews this user has already submitted
      const { data: existingReviews } = await admin
        .from('quest_reviews')
        .select('reviewed_user_id')
        .eq('quest_id', quest.id)
        .eq('reviewer_id', userId);

      const reviewedIds = new Set((existingReviews ?? []).map((r: any) => r.reviewed_user_id));
      const unreviewedMembers = (members ?? []).filter((m: any) => !reviewedIds.has(m.user_id));

      // Existing venue review?
      const { data: existingVenue } = await admin
        .from('venue_reviews')
        .select('id')
        .eq('quest_id', quest.id)
        .eq('reviewer_id', userId)
        .maybeSingle();

      const venueReviewed = !!existingVenue;

      // Skip if all reviews already done
      if (unreviewedMembers.length === 0 && venueReviewed) continue;

      pending.push({
        quest_id: quest.id,
        group_id: quest.group_id,
        venue_id: quest.venue_id,
        venue_name: (quest.venue as any)?.business_name_display ?? '?',
        completed_at: quest.completed_at,
        unreviewed_members: unreviewedMembers.map((m: any) => ({
          user_id: m.user_id,
          display_name: m.profiles.display_name,
          photo_url: m.profiles.photo_url,
        })),
        venue_reviewed: venueReviewed,
      });
    }

    return NextResponse.json({ pending });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}