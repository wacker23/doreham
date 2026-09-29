import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { hostContext, LIMITS } from '@/lib/server/events';

/** GET — what the signed-in user can host as (themselves, their venues, Doreham if admin). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const ctx = await hostContext(auth.user.id);
  return NextResponse.json({ ...ctx, limits: LIMITS });
}
