import { NextResponse } from 'next/server';
import { jsonError, requireUser } from '@/lib/server/auth';
import { moderationQueue } from '@/lib/server/events';

/** GET — admin moderation queue: hidden events and open reports. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const r = await moderationQueue(auth.user.id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
