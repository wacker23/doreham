import { NextResponse } from 'next/server';
import { isUuid, jsonError, publicError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';


const REVIEW_WINDOW_DAYS = 14;

/**
 * POST /api/submit-quest-reviews
 * body: {
 *   quest_id: string,
 *   person_reviews: [
 *     { reviewed_user_id, compliment_tags: [], vibe_tags: [], concern_tags: [] }
 *   ],
 *   venue_review: { compliment_tags: [], concern_tags: [], short_text?: string } | null
 * }
 *
 * Validates:
 *   - Quest is completed
 *   - Within 14-day window
 *   - Reviewer is the signed-in user, an accepted member, and checked in (if anyone checked in)
 *   - Reviewed users were accepted group members
 *   - Tags exist in the tag catalogs
 *   - No duplicate submission
 *
 * On success: inserts reviews + recalculates trust stats for reviewed users
 */

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const reviewer_id = auth.user.id;
  try {
    const body = await readJson<Record<string, any>>(request);
    const { quest_id, person_reviews, venue_review } = body;

    if (!isUuid(quest_id)) {
      return NextResponse.json({ error: 'quest_id required' }, { status: 400 });
    }

    const admin = getAdmin();

    // Fetch quest + group
    const { data: quest } = await admin
      .from('quests')
      .select('id, group_id, venue_id, quest_type, status, completed_at')
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
      .not('accepted_at', 'is', null)
      .maybeSingle();

    if (!reviewerMembership) {
      return NextResponse.json({ error: 'You were not a member of this quest' }, { status: 403 });
    }

    // Only people who actually showed up can review:
    //  venue quests → QR check-ins (if any were made), volunteer quests → tagged in the group selfie.
    let attendedIds: Set<string> | null = null;
    if ((quest as any).quest_type === 'volunteer') {
      const { data: proofs } = await admin
        .from('volunteer_proofs')
        .select('tagged_user_ids')
        .eq('quest_id', quest_id)
        .eq('kind', 'group_selfie');
      attendedIds = new Set((proofs ?? []).flatMap((p: any) => p.tagged_user_ids ?? []));
    } else {
      const { data: questCheckIns } = await admin
        .from('quest_check_ins')
        .select('user_id')
        .eq('quest_id', quest_id);
      if ((questCheckIns ?? []).length > 0) attendedIds = new Set((questCheckIns ?? []).map((c: any) => c.user_id));
    }
    if (attendedIds && !attendedIds.has(reviewer_id)) {
      return NextResponse.json({ error: 'Only members who attended can leave reviews' }, { status: 403 });
    }

    // Accepted group members (to validate reviewed users)
    const { data: allMembers } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', quest.group_id)
      .not('accepted_at', 'is', null);
    const validMemberIds = new Set((allMembers ?? []).map((m: any) => m.user_id));

    // Tag catalogs — reject anything that isn't a real tag id
    const [compCat, vibeCat, concernCat, venueCompCat, venueConcernCat] = await Promise.all([
      admin.from('review_compliment_tags').select('id'),
      admin.from('review_vibe_tags').select('id'),
      admin.from('review_concern_tags').select('id'),
      admin.from('venue_compliment_tags').select('id'),
      admin.from('venue_concern_tags').select('id'),
    ]);
    const ids = (r: { data: { id: string }[] | null }) => new Set((r.data ?? []).map((x) => x.id));
    const validComp = ids(compCat), validVibe = ids(vibeCat), validConcern = ids(concernCat);
    const validVenueComp = ids(venueCompCat), validVenueConcern = ids(venueConcernCat);
    const clean = (arr: unknown, valid: Set<string>): string[] =>
      Array.isArray(arr) ? [...new Set(arr.filter((t): t is string => typeof t === 'string' && valid.has(t)))] : [];

    // Insert person reviews
    const insertedPersonReviews: any[] = [];
    if (Array.isArray(person_reviews)) {
      // One review per other member at most; malformed entries are skipped.
      for (const pr of person_reviews.slice(0, validMemberIds.size)) {
        if (!pr || typeof pr !== 'object' || !isUuid(pr.reviewed_user_id) || pr.reviewed_user_id === reviewer_id) continue;
        if (!validMemberIds.has(pr.reviewed_user_id)) continue;
        // Only people who were actually there can be reviewed (same rule as pending-reviews).
        if (attendedIds && !attendedIds.has(pr.reviewed_user_id)) continue;

        // Skip if no tags at all
        pr.compliment_tags = clean(pr.compliment_tags, validComp);
        pr.vibe_tags = clean(pr.vibe_tags, validVibe);
        pr.concern_tags = clean(pr.concern_tags, validConcern);
        const hasAny =
          pr.compliment_tags.length > 0 ||
          pr.vibe_tags.length > 0 ||
          pr.concern_tags.length > 0;
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
    if (venue_review && typeof venue_review === 'object' && quest.venue_id) {
      if (typeof venue_review.short_text !== 'string') venue_review.short_text = undefined;
      venue_review.compliment_tags = clean(venue_review.compliment_tags, validVenueComp);
      venue_review.concern_tags = clean(venue_review.concern_tags, validVenueConcern);
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
    return jsonError(publicError(e, 'server_error', 'submit-quest-reviews'), 500);
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