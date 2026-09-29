-- =====================================================================
-- Points, levels, national leaderboard, badges and venue perks — Sep 29 2026
--
-- Points are earned only from things the app can verify (quest check-ins, volunteer
-- selfies, reviews, events that really had people) and lost for strikes. They are
-- written into the existing (so far unused) points_ledger by public.sync_points(),
-- which is idempotent: every award has a ref_key, and a unique index makes a second
-- run a no-op. Only the server (service role) calls these functions.
-- =====================================================================

-- 1. Ledger -----------------------------------------------------------
alter table public.points_ledger add column if not exists ref_key text;
alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
alter table public.points_ledger add constraint points_ledger_reason_check check (reason in (
  'welcome', 'quest', 'volunteer', 'volunteer_certificate', 'reviews_given', 'compliment', 'event_host', 'strike', 'admin_adjust'
));
create unique index if not exists points_ledger_once on public.points_ledger (user_id, reason, ref_key) where ref_key is not null;
create index if not exists idx_points_user_created on public.points_ledger (user_id, created_at desc);

-- 2. Running totals + leaderboard preference (written by the server only)
create table if not exists public.user_points (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total integer not null default 0,
  leaderboard_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.user_points enable row level security;
drop policy if exists "Users read own points summary" on public.user_points;
create policy "Users read own points summary" on public.user_points
  for select to authenticated using (user_id = auth.uid());

create or replace function private.points_ledger_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_points (user_id, total) values (new.user_id, new.delta)
    on conflict (user_id) do update set total = public.user_points.total + excluded.total, updated_at = now();
    return new;
  end if;
  update public.user_points set total = total - old.delta, updated_at = now() where user_id = old.user_id;
  return old;
end $$;
revoke all on function private.points_ledger_totals() from public, anon, authenticated;
drop trigger if exists points_ledger_totals on public.points_ledger;
create trigger points_ledger_totals after insert or delete on public.points_ledger
  for each row execute function private.points_ledger_totals();

-- 3. Awarding ----------------------------------------------------------
-- Returns who gained (or lost) points in this run, so the server can send level-up notifications.
create or replace function public.sync_points()
returns table (user_id uuid, gained integer)
language sql security definer set search_path = '' as $$
  with src (user_id, delta, reason, quest_id, ref_key, created_at) as (
    -- Finished onboarding
    select p.id, 20, 'welcome', null::uuid, 'profile', coalesce(p.created_at, now())
    from public.profiles p
    where p.onboarding_completed and p.deleted_at is null

    union all
    -- Venue quest: checked in to a quest that completed
    select distinct on (c.user_id, q.id) c.user_id, 50, 'quest', q.id, 'quest:' || q.id, coalesce(q.completed_at, now())
    from public.quests q
    join public.quest_check_ins c on c.quest_id = q.id
    where q.status = 'completed' and coalesce(q.quest_type, 'venue') <> 'volunteer'

    union all
    -- Volunteer quest: in (or took) a group selfie of a quest that completed
    select distinct t.user_id, 80, 'volunteer', q.id, 'quest:' || q.id, coalesce(q.completed_at, now())
    from public.quests q
    join public.volunteer_proofs v on v.quest_id = q.id and v.kind = 'group_selfie'
    cross join lateral unnest(v.tagged_user_ids || v.user_id) as t(user_id)
    where q.status = 'completed' and q.quest_type = 'volunteer'

    union all
    -- Optional 1365 certificate for a completed volunteer quest
    select distinct v.user_id, 20, 'volunteer_certificate', q.id, 'cert:' || q.id, min(v.created_at) over (partition by v.user_id, q.id)
    from public.quests q
    join public.volunteer_proofs v on v.quest_id = q.id and v.kind = 'certificate'
    where q.status = 'completed'

    union all
    -- Reviewed your group after a quest (once per quest)
    select r.reviewer_id, 10, 'reviews_given', r.quest_id, 'reviews:' || r.quest_id, min(r.submitted_at)
    from public.quest_reviews r
    group by r.reviewer_id, r.quest_id

    union all
    -- Someone in your group left you a compliment (and no concern)
    select r.reviewed_user_id, 5, 'compliment', r.quest_id, 'compliment:' || r.id, r.submitted_at
    from public.quest_reviews r
    where coalesce(cardinality(r.compliment_tags), 0) > 0
      and coalesce(cardinality(r.concern_tags), 0) = 0
      and r.reviewed_user_id <> r.reviewer_id

    union all
    -- Hosted an event that happened with at least 3 other people going; at most 2 per month (Korea time)
    select e.creator_id, 30, 'event_host', null::uuid, 'event:' || e.id, coalesce(e.ends_at, e.starts_at + interval '2 hours')
    from (
      select ev.*, row_number() over (
        partition by ev.creator_id, date_trunc('month', ev.starts_at at time zone 'Asia/Seoul')
        order by ev.starts_at, ev.id
      ) as nth
      from public.events ev
      where ev.status = 'published'
        and ev.host_kind in ('user', 'venue')
        and coalesce(ev.ends_at, ev.starts_at + interval '2 hours') < now()
        and (select count(*) from public.event_attendees a where a.event_id = ev.id and a.user_id <> ev.creator_id) >= 3
    ) e
    where e.nth <= 2

    union all
    -- Strikes
    select pen.user_id, -30, 'strike', null::uuid, 'penalty:' || pen.id, pen.created_at
    from public.user_penalties pen
  ),
  ins as (
    insert into public.points_ledger (user_id, delta, reason, quest_id, ref_key, created_at)
    select s.user_id, s.delta, s.reason, s.quest_id, s.ref_key, s.created_at
    from src s
    join public.profiles p on p.id = s.user_id
    on conflict (user_id, reason, ref_key) where ref_key is not null do nothing
    returning points_ledger.user_id, points_ledger.delta
  )
  select ins.user_id, sum(ins.delta)::integer from ins group by ins.user_id;
$$;
revoke all on function public.sync_points() from public, anon, authenticated;
grant execute on function public.sync_points() to service_role;

-- 4. National leaderboard ----------------------------------------------
-- Top p_limit people by points earned in [p_since, p_until), plus the viewer's own row.
create or replace function public.points_leaderboard(p_since timestamptz, p_until timestamptz, p_limit integer, p_viewer uuid)
returns table (user_id uuid, points bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select l.user_id, sum(l.delta) as points, max(l.created_at) as last_at
    from public.points_ledger l
    join public.profiles p on p.id = l.user_id and p.deleted_at is null
    left join public.user_points up on up.user_id = l.user_id
    where l.created_at >= p_since and l.created_at < p_until and not coalesce(up.leaderboard_hidden, false)
    group by l.user_id
  ),
  ranked as (
    select t.user_id, t.points,
      rank() over (order by t.points desc) as rank,
      row_number() over (order by t.points desc, t.last_at asc, t.user_id) as rn
    from totals t
    where t.points > 0
  )
  select r.user_id, r.points, r.rank from ranked r
  where r.rn <= p_limit or r.user_id = p_viewer
  order by r.rn;
$$;
revoke all on function public.points_leaderboard(timestamptz, timestamptz, integer, uuid) from public, anon, authenticated;
grant execute on function public.points_leaderboard(timestamptz, timestamptz, integer, uuid) to service_role;

-- Final monthly standings (for the "Top 10" badge and end-of-month notifications)
create table if not exists public.leaderboard_monthly (
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null check (rank > 0),
  points integer not null,
  created_at timestamptz not null default now(),
  primary key (period, user_id)
);
alter table public.leaderboard_monthly enable row level security;
drop policy if exists "Signed-in users read monthly standings" on public.leaderboard_monthly;
create policy "Signed-in users read monthly standings" on public.leaderboard_monthly
  for select to authenticated using (true);

-- 5. Venue perks -------------------------------------------------------
create table if not exists public.venue_perks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  details text check (details is null or char_length(details) <= 300),
  min_level smallint not null default 2 check (min_level between 1 and 6),
  source_lang text,
  translated_to text,
  title_tr text,
  details_tr text,
  translation_source_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_venue_perks_venue on public.venue_perks (venue_id);
alter table public.venue_perks enable row level security;
drop policy if exists "Signed-in users read active perks" on public.venue_perks;
create policy "Signed-in users read active perks" on public.venue_perks
  for select to authenticated using (is_active);
drop trigger if exists venue_perks_updated_at on public.venue_perks;
create trigger venue_perks_updated_at before update on public.venue_perks
  for each row execute function public.set_updated_at();

create table if not exists public.perk_redemptions (
  id uuid primary key default gen_random_uuid(),
  perk_id uuid not null references public.venue_perks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kst_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  redeemed_at timestamptz not null default now(),
  unique (perk_id, user_id, kst_date)
);
create index if not exists idx_perk_redemptions_perk on public.perk_redemptions (perk_id, kst_date);
alter table public.perk_redemptions enable row level security;
drop policy if exists "Users read own redemptions" on public.perk_redemptions;
create policy "Users read own redemptions" on public.perk_redemptions
  for select to authenticated using (user_id = auth.uid());

-- 6. Notifications -----------------------------------------------------
alter type public.notification_type add value if not exists 'level_up';
alter type public.notification_type add value if not exists 'monthly_rank';
