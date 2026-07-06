import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Runs when Supabase redirects the user back after Kakao/Google sign-in.
// URL structure:
//   /auth/callback?code=xxx&next=/some-path
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful sign-in — send the user to `next` (or homepage).
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Something failed — send them to an error page.
  return NextResponse.redirect(`${origin}/auth/error`);
}
