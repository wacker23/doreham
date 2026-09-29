-- =====================================================================
-- Events (community) — Sep 29 2026
-- A city feed of events, like the community section in Karrot.
-- Hosts: users (meetups), venue owners (promote their venue), Doreham admin (curated/featured).
-- All writes go through /api/events/* (service role) so the server can validate,
-- translate (KO↔EN) and moderate. Signed-in users can read.
-- =====================================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  host_kind text not null check (host_kind in ('user', 'venue', 'admin')),
  venue_id uuid references public.venues(id) on delete set null,
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 2000),
  category text not null,
  city text not null,
  place_name text not null check (char_length(place_name) between 2 and 100),
  address text check (address is null or char_length(address) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity between 2 and 500),
  fee_text text check (fee_text is null or char_length(fee_text) <= 60),
  -- Automatic translation between Korean and English (source text is always kept)
  source_lang text,
  translated_to text,
  title_tr text,
  description_tr text,
  place_name_tr text,
  translation_source_hash text,
  is_featured boolean not null default false,
  status text not null default 'published' check (status in ('published', 'cancelled', 'hidden')),
  cancelled_at timestamptz,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (host_kind <> 'venue' or venue_id is not null)
);
create index if not exists idx_events_city_start on public.events (city, starts_at) where status = 'published';
create index if not exists idx_events_creator on public.events (creator_id);
create index if not exists idx_events_venue on public.events (venue_id);
alter table public.events enable row level security;
drop policy if exists "Signed-in users read events" on public.events;
create policy "Signed-in users read events" on public.events
  for select to authenticated
  using (status <> 'hidden' or creator_id = auth.uid() or private.is_admin(auth.uid()));
drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table if not exists public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists idx_event_attendees_user on public.event_attendees (user_id);
alter table public.event_attendees enable row level security;
drop policy if exists "Users read own attendance" on public.event_attendees;
create policy "Users read own attendance" on public.event_attendees
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_event_comments_event on public.event_comments (event_id, created_at);
alter table public.event_comments enable row level security;
drop policy if exists "Signed-in users read comments" on public.event_comments;
create policy "Signed-in users read comments" on public.event_comments
  for select to authenticated using (deleted_at is null);

create table if not exists public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  comment_id uuid references public.event_comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'unsafe', 'offensive', 'scam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);
create unique index if not exists event_reports_once on public.event_reports
  (reporter_id, event_id, coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.event_reports enable row level security;
-- No user policies: reports are written and read by the server/admin only.

-- Notification types for events
alter type public.notification_type add value if not exists 'event_joined';
alter type public.notification_type add value if not exists 'event_comment';
alter type public.notification_type add value if not exists 'event_updated';
alter type public.notification_type add value if not exists 'event_cancelled';
alter type public.notification_type add value if not exists 'event_reminder';

-- Day-of reminder bookkeeping
alter table public.events add column if not exists reminded_at timestamptz;
