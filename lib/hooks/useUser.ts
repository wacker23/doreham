'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type Profile = {
  id: string;
  display_name: string;
  photo_url: string | null;
  onboarding_completed: boolean;
  basic_signup_completed: boolean;
};

type UseUserResult = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

/**
 * Hook that tells any component who's currently signed in.
 * Returns both the auth user (from Supabase Auth) and the profile row
 * (from public.profiles) so components can show display_name, photo, etc.
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session on first mount
    let cancelled = false;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      setUser(user);
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name, photo_url, onboarding_completed, basic_signup_completed')
          .eq('id', user.id)
          .single();
        if (!cancelled) setProfile(profileData);
      }
      if (!cancelled) setLoading(false);
    });

    // Subscribe to auth changes — signed in, signed out, token refreshed
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, display_name, photo_url, onboarding_completed, basic_signup_completed')
            .eq('id', session.user.id)
            .single();
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
