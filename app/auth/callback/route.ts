import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Runs when Supabase redirects the user back after Kakao/Google sign-in.
// URL structure:
//   /auth/callback?code=xxx&next=/some-path
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user
      const { data: { user } } = await supabase.auth.getUser();

      let redirectTo = next;

      if (user) {
        // Check profile — if no profile OR basic_signup_completed = false, route to /signup
        const { data: profile } = await supabase
          .from('profiles')
          .select('basic_signup_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile || !profile.basic_signup_completed) {
          redirectTo = '/signup';
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectTo}`);
      } else {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Something failed — send them to an error page.
  return NextResponse.redirect(`${origin}/auth/error`);
}
