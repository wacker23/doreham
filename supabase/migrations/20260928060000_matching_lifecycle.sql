-- =====================================================================
-- Matching / group lifecycle fixes (Sep 28 2026)
-- =====================================================================

-- New in-app notification types
alter type public.notification_type add value if not exists 'match_found';
alter type public.notification_type add value if not exists 'no_match_found';
alter type public.notification_type add value if not exists 'member_left';
alter type public.notification_type add value if not exists 'quest_scheduled';

-- Matching passes age from search_started_at (reset when a cancelled group
-- reopens the request) instead of created_at. This is the dead-end fix.
alter table public.match_requests add column if not exists search_started_at timestamptz;
update public.match_requests set search_started_at = created_at where search_started_at is null;
alter table public.match_requests alter column search_started_at set default now();
alter table public.match_requests alter column search_started_at set not null;

-- Check-in reminder bookkeeping (runs every 15 min on Vercel Pro)
alter table public.groups add column if not exists check_in_reminded_at timestamptz;

-- Indexes for the cron scans
create index if not exists idx_groups_phase on public.groups (phase);
create index if not exists idx_match_requests_searching on public.match_requests (search_started_at) where status = 'searching';

-- Users' own inserts: server owns search_started_at too
create or replace function public.guard_match_request_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    new.search_started_at := coalesce(new.search_started_at, now());
    return new;
  end if;
  if private.is_user_frozen(auth.uid()) then
    raise exception 'account_frozen' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.match_requests where user_id = auth.uid() and status = 'searching') then
    raise exception 'already_searching' using errcode = 'P0001';
  end if;
  new.user_id := auth.uid();
  new.status := 'searching';
  new.matched_group_id := null;
  new.resolved_at := null;
  new.attempt_count := 0;
  new.last_attempt_at := null;
  new.excluded_user_ids := array[]::uuid[];
  new.created_at := now();
  new.search_started_at := now();
  return new;
end $$;
revoke execute on function public.guard_match_request_insert() from public, anon, authenticated;

-- Data cleanup: "zombie" groups (cancelled by decline/expiry but left in an active phase)
update public.groups g
set phase = 'cancelled', is_pending_invites = false
where g.phase in ('availability', 'voting', 'scheduled')
  and not exists (
    select 1 from public.group_members gm
    where gm.group_id = g.id and gm.left_at is null
  );

-- Groups whose quest completed should say so
update public.groups g
set phase = 'completed'
from public.quests q
where q.group_id = g.id and q.status = 'completed' and g.phase is distinct from 'completed';
