-- =====================================================================
-- Consents + privacy clean-up (Sep 29 2026)
-- * user_consents: separate, versioned consent records (volunteer photos for now).
--   Written only by the server (/api/consents), readable by the owner.
-- * Volunteer requests need the volunteer-photo consent.
-- * Check-ins no longer keep raw GPS coordinates (distance only).
-- =====================================================================
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('volunteer_photos')),
  version text not null,
  agreed_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create unique index if not exists user_consents_active_key on public.user_consents (user_id, kind) where withdrawn_at is null;
alter table public.user_consents enable row level security;
drop policy if exists "Users read own consents" on public.user_consents;
create policy "Users read own consents" on public.user_consents for select to authenticated using (user_id = auth.uid());

create or replace function private.has_consent(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_consents where user_id = p_user and kind = p_kind and withdrawn_at is null);
$$;
revoke execute on function private.has_consent(uuid, text) from public, anon, authenticated;

create or replace function public.guard_match_request_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Normalise cities for everyone: lowercase slugs, no duplicates, `city` = first choice.
  if new.cities is null or cardinality(new.cities) = 0 then
    new.cities := case when new.city is null then null else array[lower(new.city)] end;
  else
    new.cities := (
      select array_agg(c order by first_pos)
      from (
        select lower(trim(x)) as c, min(ord) as first_pos
        from unnest(new.cities) with ordinality as t(x, ord)
        where lower(trim(x)) ~ '^[a-z]{2,20}$'
        group by lower(trim(x))
      ) d
    );
  end if;
  if new.cities is not null and cardinality(new.cities) > 3 then
    new.cities := new.cities[1:3];
  end if;
  new.city := new.cities[1];

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
  if coalesce(new.quest_type, 'venue') = 'volunteer' and not private.has_consent(auth.uid(), 'volunteer_photos') then
    raise exception 'consent_required' using errcode = 'P0001';
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
  new.quest_type := coalesce(new.quest_type, 'venue');
  return new;
end $$;
revoke execute on function public.guard_match_request_insert() from public, anon, authenticated;

-- Data minimisation: check-ins keep the distance to the venue, not the user's coordinates.
update public.quest_check_ins set latitude = null, longitude = null where latitude is not null or longitude is not null;
