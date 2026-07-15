'use client';

import { supabase } from '@/lib/supabase/client';
import type { VenueFormData, MenuItem } from './types';

export function validateBusinessNumber(brn: string): boolean {
  const digits = brn.replace(/[-\s]/g, '');
  if (!/^\d{10}$/.test(digits)) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  sum += Math.floor((parseInt(digits[8], 10) * 5) / 10);

  const checksum = (10 - (sum % 10)) % 10;

  return checksum === parseInt(digits[9], 10);
}

export function formatBusinessNumber(brn: string): string {
  const digits = brn.replace(/[-\s]/g, '');
  if (digits.length !== 10) return brn;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export async function uploadPhoto(
  file: File,
  bucket: 'venue-photos' | 'venue-menu-photos',
  path: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error(`Upload error to ${bucket}:`, error);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function submitVenue(
  formData: VenueFormData,
  uploadedPhotoUrls: string[],
  uploadedMenuItems: MenuItem[]
): Promise<{ ok: true; venueId: string } | { ok: false; error: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_signed_in' };

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .insert({
      owner_id: user.id,
      business_name_display: formData.business_name_display,
      business_name_legal: formData.business_name_legal,
      business_registration_number: formData.business_registration_number,
      category: formData.category,
      address: formData.address,
      zipcode: formData.zipcode || null,
      road_address: formData.road_address || null,
      jibun_address: formData.jibun_address || null,
      building_name: formData.building_name || null,
      address_detail: formData.address_detail || null,
      city: formData.city,
      district: formData.district,
      business_opened_at: formData.business_opened_at || null,
      description: formData.description || null,
      description_en: formData.description_en || null,
      per_person_cost_won: formData.per_person_cost_won || null,
      discount_offer: formData.discount_offer || null,
      discount_offer_en: formData.discount_offer_en || null,
      photo_urls: uploadedPhotoUrls,
      hours_json: formData.hours,
      claim_method: 'business_registration',
      is_active: false,
      // Contact info (new)
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      contact_name: formData.contact_name || null,
    })
    .select('id')
    .single();

  if (venueError || !venue) {
    console.error('Venue insert error:', venueError);
    return { ok: false, error: venueError?.message ?? 'unknown_error' };
  }

  if (uploadedMenuItems.length > 0) {
    const menuRows = uploadedMenuItems.map((item, i) => ({
      venue_id: venue.id,
      name: item.name,
      name_en: item.name_en || null,
      description: item.description || null,
      price_won: item.price_won || null,
      photo_url: item.photo_url || null,
      is_signature: item.is_signature,
      display_order: i,
    }));

    const { error: menuError } = await supabase
      .from('venue_menu_items')
      .insert(menuRows);

    if (menuError) {
      console.error('Menu items insert error:', menuError);
    }
  }

  // Trigger submission confirmation email (fire and forget — don't block on it)
  if (formData.contact_email && formData.business_name_display) {
    fetch('/api/emails/venue-submitted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: formData.contact_email,
        venueName: formData.business_name_display,
      }),
    }).catch((e) => {
      console.error('Email trigger failed (non-fatal):', e);
    });
  }

  return { ok: true, venueId: venue.id };
}

export async function verifyBusinessNumberWithGov(
  brn: string
): Promise<{ valid: boolean; status?: string; businessName?: string; reason?: string }> {
  try {
    const response = await fetch('/api/verify-business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brn: brn.replace(/[-\s]/g, '') }),
    });

    if (!response.ok) {
      return { valid: false, reason: 'api_error' };
    }

    return await response.json();
  } catch (e) {
    console.error('Business verification error:', e);
    return { valid: false, reason: 'network_error' };
  }
}