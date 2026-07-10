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

  return { ok: true };
}