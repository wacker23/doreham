import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/venue-qr/[venue_id]
 * Returns today's active QR code for a venue.
 * If none exists for today, creates a new one.
 * Anyone can call this (venue owner sees it in their dashboard,
 * users see it if they need to display QR for the venue).
 */

// Generate a short human-readable code (like "ABCD-1234")
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (O, 0, I, 1)
  let letters = '';
  for (let i = 0; i < 4; i++) letters += chars[Math.floor(Math.random() * chars.length)];
  const nums = String(Math.floor(1000 + Math.random() * 9000));
  return `${letters}-${nums}`;
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ venue_id: string }> }) {
  try {
    const { venue_id } = await params;
    if (!venue_id) return NextResponse.json({ error: 'venue_id required' }, { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const today = todayDate();

    // Check for existing code today
    const { data: existing } = await admin
      .from('venue_qr_codes')
      .select('id, code, valid_date, created_at')
      .eq('venue_id', venue_id)
      .eq('valid_date', today)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        id: existing.id,
        code: existing.code,
        valid_date: existing.valid_date,
        venue_id,
      });
    }

    // Generate a new one for today
    let code = generateCode();
    // Ensure uniqueness (very unlikely collision, but safe)
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: dup } = await admin
        .from('venue_qr_codes')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (!dup) break;
      code = generateCode();
    }

    const { data: created, error: createErr } = await admin
      .from('venue_qr_codes')
      .insert({ venue_id, code, valid_date: today })
      .select('id, code, valid_date')
      .single();

    if (createErr || !created) {
      return NextResponse.json({ error: `Create failed: ${createErr?.message}` }, { status: 500 });
    }

    return NextResponse.json({
      id: created.id,
      code: created.code,
      valid_date: created.valid_date,
      venue_id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}