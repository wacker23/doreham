import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REVIEW_WINDOW_DAYS = 14;

/**
 * POST /api/submit-quest-reviews
 * body: {
 *   quest_id: string,
 *   reviewer_id: string,
 *   person_reviews: [
 *     { reviewed_user_id, compliment_tags: [], vibe_tags: [], concern_tags: [] }
 *   ],
 *   venue_review: { compliment_tags: [], concern_tags: [], short_text?: string } | null
 * }
 *
 * Validates:
 *   - Quest is completed
 *   - Within 14-day window
 *   - Reviewer was a member of the group
 *   - Reviewed users were group members
 *   - No duplicate submission
 *
 * On success: inserts reviews + recalculates trust stats for reviewed users
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quest_id, reviewer_id, person_reviews, venue_review } = body;

    if (!quest_id || !reviewer_id) {
      return NextResponse.json({ error: 'quest_id and reviewer_id required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch quest + group
    const { data: quest } = await admin
      .from('quests')
      .select('id, group_id, venue_id, status, completed_at')
      .eq('id', quest_id)
      .maybeSingle();

    if (!quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    if (quest.status !== 'completed') {
      return NextResponse.json({ error: 'Quest not completed yet' }, { status: 400 });
    }

    // Check 14-day window
    if (quest.completed_at) {
      const daysSince = (Date.now() - new Date(quest.completed_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > REVIEW_WINDOW_DAYS) {
        return NextResponse.json({ error: `Review window (${REVIEW_WINDOW_DAYS} days) has closed` }, { status: 400 });
      }
    }

    // Verify reviewer was a member of the group (need to include left_at since they've left after quest completed)
    const { data: reviewerMembership } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', quest.group_id)
      .eq('user_id', reviewer_id)
      .maybeSingle();

    if (!reviewerMembership) {
      return NextResponse.json({ error: 'You were not a member of this quest' }, { status: 403 });
    }

    // Get all group members (to validate reviewed users)
    const { data: allMembers } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', quest.group_id);
    const validMemberIds = new Set((allMembers ?? []).map((m: any) => m.user_id));

    // Insert person reviews
    const insertedPersonReviews: any[] = [];
    if (Array.isArray(person_reviews)) {
      for (const pr of person_reviews) {
        if (!pr.reviewed_user_id || pr.reviewed_user_id === reviewer_id) continue;
        if (!validMemberIds.has(pr.reviewed_user_id)) continue;

        // Skip if no tags at all
        const hasAny = 
          (pr.compliment_tags?.length ?? 0) > 0 ||
          (pr.vibe_tags?.length ?? 0) > 0 ||
          (pr.concern_tags?.length ?? 0) > 0;
        if (!hasAny) continue;

        const { data: inserted, error: prErr } = await admin
          .from('quest_reviews')
          .insert({
            quest_id,
            group_id: quest.group_id,
            reviewer_id,
            reviewed_user_id: pr.reviewed_user_id,
            compliment_tags: pr.compliment_tags ?? [],
            vibe_tags: pr.vibe_tags ?? [],
            concern_tags: pr.concern_tags ?? [],
          })
          .select('id, reviewed_user_id')
          .single();

        if (prErr) {
          // Silently skip duplicates (already reviewed)
          if (!prErr.message.includes('duplicate key')) {
            console.error('Person review insert failed:', prErr);
          }
          continue;
        }
        if (inserted) insertedPersonReviews.push(inserted);
      }
    }

    // Insert venue review
    let insertedVenueReview: any = null;
    if (venue_review && quest.venue_id) {
      const hasVenueContent = 
        (venue_review.compliment_tags?.length ?? 0) > 0 ||
        (venue_review.concern_tags?.length ?? 0) > 0 ||
        (venue_review.short_text?.trim().length ?? 0) > 0;

      if (hasVenueContent) {
        // Validate short_text length
        const text = venue_review.short_text?.trim() ?? null;
        if (text && (text.length < 30 || text.length > 100)) {
          return NextResponse.json({
            error: 'Venue text must be 30-100 characters',
          }, { status: 400 });
        }

        const { data: vInserted, error: vErr } = await admin
          .from('venue_reviews')
          .insert({
            quest_id,
            venue_id: quest.venue_id,
            reviewer_id,
            compliment_tags: venue_review.compliment_tags ?? [],
            concern_tags: venue_review.concern_tags ?? [],
            short_text: text,
          })
          .select('id')
          .single();

        if (vErr && !vErr.message.includes('duplicate key')) {
          console.error('Venue review insert failed:', vErr);
        }
        if (vInserted) insertedVenueReview = vInserted;
      }
    }

    // Recalculate trust stats for each reviewed user
    for (const pr of insertedPersonReviews) {
      await recalculateTrustStats(admin, pr.reviewed_user_id);
    }

    return NextResponse.json({
      ok: true,
      person_reviews_submitted: insertedPersonReviews.length,
      venue_review_submitted: !!insertedVenueReview,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function recalculateTrustStats(admin: any, userId: string) {
  // Fetch all reviews for this user
  const { data: reviews } = await admin
    .from('quest_reviews')
    .select('compliment_tags, vibe_tags, concern_tags')
    .eq('reviewed_user_id', userId);

  if (!reviews) return;

  const complimentCounts: Record<string, number> = {};
  const vibeCounts: Record<string, number> = {};
  const concernCounts: Record<string, number> = {};

  for (const r of reviews) {
    for (const t of r.compliment_tags ?? []) complimentCounts[t] = (complimentCounts[t] ?? 0) + 1;
    for (const t of r.vibe_tags ?? []) vibeCounts[t] = (vibeCounts[t] ?? 0) + 1;
    for (const t of r.concern_tags ?? []) concernCounts[t] = (concernCounts[t] ?? 0) + 1;
  }

  // Upsert into user_trust_stats
  await admin.from('user_trust_stats').upsert({
    user_id: userId,
    total_reviews_received: reviews.length,
    compliment_counts: complimentCounts,
    vibe_counts: vibeCounts,
    concern_counts: concernCounts,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}