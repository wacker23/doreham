'use client';

import { supabase } from '@/lib/supabase/client';
import type { OnboardingFormData } from './types';

// Saves a partial onboarding form state to the profiles table for the current user.
// Only writes the fields present in `partial` — leaves others untouched.
// Returns { ok: true } on success, { ok: false, error: string } on failure.
export async function savePartialProfile(
  partial: Partial<OnboardingFormData>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: 'not_signed_in' };
  }

  const { error } = await supabase
    .from('profiles')
    .update(partial)
    .eq('id', user.id);

  if (error) {
    console.error('savePartialProfile error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// Marks onboarding as complete. Called at the very end after step 5.
export async function completeOnboarding(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: 'not_signed_in' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  if (error) {
    console.error('completeOnboarding error:', error);
    return { ok: false, error: error.message };
  }

  // Fire welcome email + notification (non-blocking — don't fail onboarding if these fail)
  fetch('/api/emails/welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id }),
  }).catch((e) => console.error('Welcome email failed (non-fatal):', e));

  // Fetch language for notification
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.display_name || '';

  fetch('/api/create-welcome-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id, display_name: displayName }),
  }).catch((e) => console.error('Welcome notification failed (non-fatal):', e));

  return { ok: true };
}