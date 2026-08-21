import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/quest-check-in
 * body: {
 *   user_id: string,
 *   group_id: string,
 *   qr_code: string,        // Scanned or entered code (e.g. "ABCD-1234")
 *   latitude?: number,       // From navigator.geolocation
 *   longitude?: number,
 * }
 *
 * Validates:
 *   1. User is an active member of the group
 *   2. QR code is valid for the venue tied to this group's quest
 *   3. QR is for TODAY
 *   4. Current time is within check-in window (40 min before to 2h after quest_scheduled_at)
 *   5. If GPS provided: user is within 200m of venue
 *   6. User hasn't already checked in for this quest
 *
 * On success: creates quest_check_ins row + evaluates if quest should complete.
 * Quest completes when >=2 checked in.
 */

const CHECK_IN_WINDOW_BEFORE_MIN = 40;
const CHECK_IN_WINDOW_AFTER_MIN = 120;
const MAX_DISTANCE_M = 200;

// Haversine formula — distance in meters between two lat/lng points
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    const { user_id, group_id, qr_code, latitude, longitude } = await request.json();
    if (!user_id || !group_id || !qr_code) {
      return NextResponse.json({ error: 'user_id, group_id, qr_code required' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Verify group membership
    const { data: membership } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at, left_at')
      .eq('group_id', group_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (!membership || membership.left_at) {
      return NextResponse.json({ error: 'Not an active member of this group' }, { status: 403 });
    }

    if (membership.invite_state !== 'accepted' && !membership.accepted_at) {
      return NextResponse.json({ error: 'You must have accepted the match to check in' }, { status: 400 });
    }

    // 2. Get the quest + group (quest_scheduled_at lives on groups)
    const { data: quest } = await admin
      .from('quests')
      .select('id, venue_id, status, expires_at, venue:venues!inner(id, latitude, longitude, business_name_display)')
      .eq('group_id', group_id)
      .maybeSingle();

    const { data: groupData } = await admin
      .from('groups')
      .select('quest_scheduled_at, phase')
      .eq('id', group_id)
      .maybeSingle();

    if (!quest) return NextResponse.json({ error: 'No quest found for this group' }, { status: 404 });
    if (quest.status === 'completed') {
      return NextResponse.json({ error: 'Quest already completed' }, { status: 400 });
    }
    if (quest.status === 'cancelled') {
      return NextResponse.json({ error: 'Quest was cancelled' }, { status: 400 });
    }
        if (!groupData?.quest_scheduled_at) {
      return NextResponse.json({ error: 'Quest date not scheduled yet' }, { status: 400 });
    }

    // 3. Validate QR — is it for today AND for the correct venue?
    const cleanedCode = qr_code.trim().toUpperCase();
    const { data: qrRecord } = await admin
      .from('venue_qr_codes')
      .select('id, venue_id, valid_date')
      .eq('code', cleanedCode)
      .maybeSingle();

    if (!qrRecord) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    // Check QR is for today
    const today = new Date().toISOString().split('T')[0];
    if (qrRecord.valid_date !== today) {
      return NextResponse.json({ error: 'This QR code has expired. Ask the venue for today\'s code.' }, { status: 400 });
    }

    // Check QR is for this quest's venue
    if (qrRecord.venue_id !== quest.venue_id) {
      return NextResponse.json({ error: 'This QR is for a different venue' }, { status: 400 });
    }

    // 4. Check time window
    const scheduledMs = new Date(groupData.quest_scheduled_at).getTime();
    const nowMs = Date.now();
    const windowStart = scheduledMs - CHECK_IN_WINDOW_BEFORE_MIN * 60 * 1000;
    const windowEnd = scheduledMs + CHECK_IN_WINDOW_AFTER_MIN * 60 * 1000;

    if (nowMs < windowStart) {
      const minsUntil = Math.ceil((windowStart - nowMs) / 60000);
      return NextResponse.json({
        error: `Too early to check in. Check-in opens in ${minsUntil} minutes.`
      }, { status: 400 });
    }

    if (nowMs > windowEnd) {
      return NextResponse.json({
        error: 'Check-in window has closed for this quest.'
      }, { status: 400 });
    }

    // 5. GPS check (if provided)
    let distance: number | null = null;
    let locationVerified = false;
    const venue = quest.venue as any;

    if (latitude != null && longitude != null && venue.latitude != null && venue.longitude != null) {
      distance = distanceMeters(latitude, longitude, Number(venue.latitude), Number(venue.longitude));
      if (distance > MAX_DISTANCE_M) {
        return NextResponse.json({
          error: `You seem to be ${Math.round(distance)}m from ${venue.business_name_display}. Get closer to the venue to check in.`,
        }, { status: 400 });
      }
      locationVerified = true;
    }
    // If no GPS: allow but flag as unverified

    // 6. Check for existing check-in
    const { data: existing } = await admin
      .from('quest_check_ins')
      .select('id')
      .eq('quest_id', quest.id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You already checked in for this quest.' }, { status: 400 });
    }

    // Create check-in
    const { data: checkIn, error: insertErr } = await admin
      .from('quest_check_ins')
      .insert({
        quest_id: quest.id,
        user_id,
        venue_id: quest.venue_id,
        qr_code_id: qrRecord.id,
        latitude,
        longitude,
        distance_m: distance,
        location_verified: locationVerified,
      })
      .select('id, checked_in_at')
      .single();

    if (insertErr || !checkIn) {
      return NextResponse.json({ error: `Check-in failed: ${insertErr?.message}` }, { status: 500 });
    }

    // Get total check-in count (for UI display only — quest completion happens later at window close)
    const { count: checkInCount } = await admin
      .from('quest_check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('quest_id', quest.id);

    // Get window end time for the user's info
    const windowEndTime = new Date(scheduledMs + CHECK_IN_WINDOW_AFTER_MIN * 60 * 1000).toISOString();

    return NextResponse.json({
      ok: true,
      checked_in: true,
      check_in_count: checkInCount ?? 0,
      window_ends_at: windowEndTime,
      location_verified: locationVerified,
      distance_m: distance,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}