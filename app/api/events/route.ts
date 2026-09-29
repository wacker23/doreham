import { NextResponse } from 'next/server';
import { jsonError, readJson, requireUser } from '@/lib/server/auth';
import { createEvent, listEvents, type EventInput } from '@/lib/server/events';

/** GET ?city=&category=&scope=upcoming|mine|past — the events feed. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const events = await listEvents(auth.user.id, {
    city: url.searchParams.get('city') || null,
    category: url.searchParams.get('category') || null,
    scope: scope === 'mine' || scope === 'past' ? scope : 'upcoming',
  });
  return NextResponse.json({ events });
}

/** POST EventInput — create an event. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const input = await readJson<EventInput>(request);
  const r = await createEvent(auth.user.id, input);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
