/** Shapes returned by /api/events*. Client-safe. */

export type EventHost = {
  kind: 'user' | 'venue' | 'admin';
  name: string;
  photo_url: string | null;
  profile_id: string | null;
  venue_id: string | null;
  /** Doreham level of a member host (null for venues and Doreham). */
  level?: number | null;
};

export type EventBase = {
  id: string;
  host_kind: 'user' | 'venue' | 'admin';
  title: string;
  description: string;
  category: string;
  city: string;
  place_name: string;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  fee_text: string | null;
  source_lang: string | null;
  translated_to: string | null;
  title_tr: string | null;
  description_tr: string | null;
  place_name_tr: string | null;
  is_featured: boolean;
  status: 'published' | 'cancelled' | 'hidden';
  created_at: string;
  poster_url?: string | null;
};

export type FeedEvent = EventBase & {
  host: EventHost;
  going_count: number;
  viewer_going: boolean;
  viewer_is_host: boolean;
};

export type EventPerson = { id: string; display_name: string; photo_url: string | null };

export type EventComment = {
  id: string;
  body: string;
  created_at: string;
  author: EventPerson;
  can_delete: boolean;
};

export type EventReport = {
  id: string;
  event_id?: string;
  comment_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type EventDetail = {
  event: EventBase & { hidden_reason: string | null; host: EventHost; going_count: number; is_full: boolean };
  attendees: EventPerson[];
  comments: EventComment[];
  viewer: { going: boolean; is_host: boolean; is_admin: boolean; can_edit: boolean };
  reports?: EventReport[];
};

export type HostContext = {
  canHost: boolean;
  frozen: boolean;
  /** Hosting a new event needs Doreham+ (false during the test period). */
  plusRequired: boolean;
  onboarded: boolean;
  homeDistrict: string | null;
  isAdmin: boolean;
  venues: { id: string; name: string; city: string }[];
  limits: { userUpcoming: number; venueUpcoming: number; minLeadMinutes: number; maxAheadDays: number; maxHours: number };
};

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}
