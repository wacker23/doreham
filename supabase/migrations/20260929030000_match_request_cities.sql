-- =====================================================================
-- Multi-city match requests (Sep 29 2026)
-- A request may list up to 3 cities; NULL/empty = anywhere. `city` stays as
-- the first choice so older screens and the admin page keep working.
-- =====================================================================
alter table public.match_requests add column if not exists cities text[];
update public.match_requests set cities = array[lower(city)] where city is not null and cities is null;
alter table public.match_requests drop constraint if exists match_requests_cities_max;
alter table public.match_requests add constraint match_requests_cities_max check (cities is null or cardinality(cities) <= 3);

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
