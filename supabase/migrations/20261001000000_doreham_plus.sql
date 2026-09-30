-- =====================================================================
-- Doreham+ plan — Oct 1 2026
-- One paid plan (Doreham+). Stored on profiles.subscription_tier / subscription_expires_at
-- (already guarded: users can't change them). Until payments exist, Doreham gives
-- Doreham+ by hand (admin page). Free plan:
--   * 2 venue match requests per KST month (봉사 requests are unlimited; requests that end
--     in no_match_found / cancelled / expired, or whose group fell apart, don't count)
--   * random group size, no category choice (봉사 can always be chosen)
--   * registering a new venue needs Doreham+ (existing venues stay)
-- Events: +2 open events for Doreham+ (enforced in the app server).
-- =====================================================================

create or replace function private.has_plus(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.subscription_tier = 'plus'
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  );
$$;
revoke all on function private.has_plus(uuid) from public, anon, authenticated;

create or replace function private.match_requests_this_month(p_user uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int
  from public.match_requests r
  left join public.groups g on g.id = r.matched_group_id
  where r.user_id = p_user
    and coalesce(r.quest_type, 'venue') <> 'volunteer'
    and r.created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    and (
      r.status = 'searching'
      or (r.status = 'matched' and (g.id is null or g.status not in ('dissolved', 'expired')))
    );
$$;
revoke all on function private.match_requests_this_month(uuid) from public, anon, authenticated;

-- What the app shows about someone's plan (called by the server with the service role).
create or replace function public.plan_status(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'plus', private.has_plus(p.id),
    'expires_at', case when p.subscription_tier = 'plus' then p.subscription_expires_at end,
    'match_requests_used', private.match_requests_this_month(p.id),
    'match_requests_limit', 2
  )
  from public.profiles p
  where p.id = p_user;
$$;
revoke all on function public.plan_status(uuid) from public, anon, authenticated;
grant execute on function public.plan_status(uuid) to service_role;

-- Match requests: same rules as before, plus the free-plan limits.
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

  -- Free plan
  if not private.has_plus(auth.uid()) then
    new.group_size := null; -- random size
    if coalesce(new.quest_type, 'venue') <> 'volunteer' then
      new.preferred_categories := null; -- any category
      if private.match_requests_this_month(auth.uid()) >= 2 then
        raise exception 'monthly_limit' using errcode = 'P0001';
      end if;
    end if;
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

-- Venues: registering a new one is a Doreham+ feature. Everything else unchanged.
create or replace function public.guard_venue_privileged_columns()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not private.has_plus(auth.uid()) then
      raise exception 'plus_required' using errcode = 'P0001';
    end if;
    select count(*) into v_count from public.venues
      where owner_id = auth.uid() and deactivated_at is null;
    if v_count >= 2 then
      raise exception 'venue_limit_reached' using errcode = 'P0001';
    end if;
    new.owner_id := auth.uid();
    new.is_active := false;
    new.claim_verified_at := null;
    new.hidden_gem_eligible := false;
    new.hidden_gem_evaluated_at := null;
    new.boost_until := null;
    new.deactivated_at := null;
    return new;
  end if;
  new.owner_id := old.owner_id;
  new.is_active := old.is_active;
  new.claim_method := old.claim_method;
  new.claim_verified_at := old.claim_verified_at;
  new.hidden_gem_eligible := old.hidden_gem_eligible;
  new.hidden_gem_evaluated_at := old.hidden_gem_evaluated_at;
  new.boost_until := old.boost_until;
  new.created_at := old.created_at;
  if old.deactivated_at is not null then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $$;
revoke execute on function public.guard_venue_privileged_columns() from public, anon, authenticated;

alter type public.notification_type add value if not exists 'plus_granted';
