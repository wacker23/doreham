import { NextResponse } from 'next/server';
import { jsonError, publicError, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';


const REVIEW_WINDOW_DAYS = 14;

/**
 * GET /api/pending-reviews  (signed-in user)
 *
 * Returns list of quests the user completed but hasn't reviewed yet.
 * For each: quest info, other members to review, venue info.
 */

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  try {

    const admin = getAdmin();

    // Find groups this user was a member of with completed quests within the review window
    const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: memberships } = await admin
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    const groupIds = memberships.map((m: any) => m.group_id);

    const { data: quests } = await admin
      .from('quests')
      .select('id, group_id, venue_id, quest_type, completed_at, venue:venues(id, business_name_display), program:volunteer_programs(title, title_en)')
      .in('group_id', groupIds)
      .eq('status', 'completed')
      .gte('completed_at', cutoff);

    if (!quests || quests.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    // For each quest: who has this user NOT reviewed yet?
    const pending: any[] = [];

    for (const quest of quests) {
      const isVolunteer = (quest as any).quest_type === 'volunteer';

      // Volunteer quests: only people in the group selfie reviewed each other.
      let attended: Set<string> | null = null;
      if (isVolunteer) {
        const { data: proofs } = await admin
          .from('volunteer_proofs')
          .select('tagged_user_ids')
          .eq('quest_id', quest.id)
          .eq('kind', 'group_selfie');
        attended = new Set((proofs ?? []).flatMap((p: any) => p.tagged_user_ids ?? []));
        if (!attended.has(userId)) continue;
      }

      // Group members (excluding self)
      const { data: members } = await admin
        .from('group_members')
        .select('user_id, profiles:profiles!inner(id, display_name, photo_url)')
        .eq('group_id', quest.group_id)
        .not('accepted_at', 'is', null)
        .neq('user_id', userId);

      // Reviews this user has already submitted
      const { data: existingReviews } = await admin
        .from('quest_reviews')
        .select('reviewed_user_id')
        .eq('quest_id', quest.id)
        .eq('reviewer_id', userId);

      const reviewedIds = new Set((existingReviews ?? []).map((r: any) => r.reviewed_user_id));
      const unreviewedMembers = (members ?? []).filter(
        (m: any) => !reviewedIds.has(m.user_id) && (!attended || attended.has(m.user_id)),
      );

      // Existing venue review?
      const { data: existingVenue } = await admin
        .from('venue_reviews')
        .select('id')
        .eq('quest_id', quest.id)
        .eq('reviewer_id', userId)
        .maybeSingle();

      // Volunteer quests have no venue to review.
      const venueReviewed = isVolunteer || !quest.venue_id || !!existingVenue;

      // Skip if all reviews already done
      if (unreviewedMembers.length === 0 && venueReviewed) continue;

      pending.push({
        quest_id: quest.id,
        group_id: quest.group_id,
        venue_id: quest.venue_id,
        venue_name: isVolunteer
          ? `${(quest as any).program?.title ?? '봉사활동'}`
          : ((quest.venue as any)?.business_name_display ?? '?'),
        // English title for volunteer quests (1365 is Korean-only); null means "use venue_name".
        venue_name_en: isVolunteer && (quest as any).program?.title_en ? `${(quest as any).program.title_en}` : null,
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
    return jsonError(publicError(e, 'server_error', 'pending-reviews'), 500);
  }
}